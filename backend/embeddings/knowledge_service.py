"""
Knowledge Service (Phase 2).

Handles:
1. index_repository(repository) — parse, embed, and persist all code chunks.
2. search_code(repository_id, query_text, top_k) — pgvector cosine distance search,
   strictly scoped by repository_id.

pgvector Strategy
-----------------
We store embeddings as vector(384) columns. The migration applies the pgvector
extension and converts the column using raw SQL.

Vector search uses:
    ORDER BY embedding <=> query_vec::vector
which is pgvector's native cosine distance operator, executed fully in the database.
This avoids loading all embeddings into Python and scales with repository size.

SQLite Fallback
---------------
During local development with SQLite, pgvector is unavailable. In this case we
fall back to Python-side cosine similarity using numpy. The code auto-detects the
database backend and picks the correct search strategy at query time.
"""

import logging
import json

from django.conf import settings
from django.db import connection

from embeddings.models import CodeChunk
from embeddings.embedding_service import embed_text, embed_batch, cosine_similarity
from parser.chunker import chunk_repository

logger = logging.getLogger(__name__)

# Minimum similarity to include a chunk in search results.
# Keeps very-low-relevance noise out of the Gemini context.
MIN_SIMILARITY = 0.20

# How many chunks to retrieve per query (configurable)
DEFAULT_TOP_K = 6


def _is_postgres() -> bool:
    """Return True if the active DB backend is PostgreSQL."""
    engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    return 'postgresql' in engine or 'postgis' in engine


def _pgvector_available() -> bool:
    """Check if pgvector extension is installed in the current PostgreSQL database."""
    if not _is_postgres():
        return False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            return cursor.fetchone() is not None
    except Exception:
        return False


def index_repository(repository) -> None:
    """
    Parse the repository's cloned directory, generate embeddings for all code chunks,
    and persist them as CodeChunk records.

    Called explicitly via POST /api/repositories/<id>/index/.
    NEVER called automatically from the chat endpoint.

    Sets repository.is_indexed = True and repository.index_status = 'indexed' on success,
    or 'failed' on error.
    """
    from django.conf import settings as s

    # Mark as indexing
    repository.index_status = 'indexing'
    repository.index_error = ''
    repository.save(update_fields=['index_status', 'index_error'])

    try:
        # Resolve the cloned repo directory
        repo_dir = str(s.CLONED_REPOS_DIR / f'{repository.owner}_{repository.name}_{repository.id}')
        logger.info('Indexing repository %s from %s', repository, repo_dir)

        # 1. Parse into chunks
        chunks = chunk_repository(repo_dir)
        if not chunks:
            logger.warning('No chunks extracted from %s', repo_dir)

        # 2. Delete old chunks for this repository (re-index is clean)
        deleted, _ = CodeChunk.objects.filter(repository=repository).delete()
        logger.info('Deleted %d stale chunks for repo %d', deleted, repository.id)

        # 3. Embed in batches and persist
        contents = [c['content'] for c in chunks]
        embeddings = embed_batch(contents)

        batch_size = 200
        records = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            records.append(CodeChunk(
                repository=repository,
                file_path=chunk['file_path'],
                symbol_name=chunk.get('symbol_name', ''),
                symbol_type=chunk.get('symbol_type', 'block'),
                start_line=chunk['start_line'],
                end_line=chunk['end_line'],
                content=chunk['content'],
                embedding=emb,     # stored as JSON list
            ))
            if len(records) >= batch_size:
                CodeChunk.objects.bulk_create(records)
                records = []
        if records:
            CodeChunk.objects.bulk_create(records)

        total = CodeChunk.objects.filter(repository=repository).count()
        logger.info('Indexed %d chunks for repo %d', total, repository.id)

        # 4. If using PostgreSQL + pgvector, convert JSON → vector column
        if _is_postgres():
            _apply_pgvector_column(repository)

        # 5. Mark success
        repository.is_indexed = True
        repository.index_status = 'indexed'
        repository.save(update_fields=['is_indexed', 'index_status', 'index_error'])

    except Exception as exc:
        logger.exception('Indexing failed for repo %d: %s', repository.id, exc)
        repository.index_status = 'failed'
        repository.index_error = str(exc)
        repository.is_indexed = False
        repository.save(update_fields=['is_indexed', 'index_status', 'index_error'])
        raise


def _apply_pgvector_column(repository) -> None:
    """
    After bulk_create (which writes embedding as JSON text),
    run a raw SQL UPDATE to cast the JSON array into a pgvector vector column.

    This only applies when the DB is PostgreSQL with pgvector installed.
    Falls back silently on SQLite.
    """
    if not _pgvector_available():
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE embeddings_codechunk
                SET embedding_vec = embedding::text::vector
                WHERE repository_id = %s
                """,
                [repository.id],
            )
        logger.info('pgvector column updated for repo %d', repository.id)
    except Exception as exc:
        logger.warning('pgvector column update skipped: %s', exc)


def search_code(repository_id: int, query_text: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
    """
    Retrieve the top_k most relevant code chunks for a query, strictly scoped to
    a single repository.

    Uses pgvector native cosine distance (<=> operator) when PostgreSQL + pgvector
    is available; otherwise falls back to Python-side cosine similarity for SQLite
    development.

    Returns a list of dicts:
        {
            'file_path': str,
            'symbol_name': str,
            'symbol_type': str,
            'start_line': int,
            'end_line': int,
            'content': str,
            'similarity': float,
        }
    """
    if not query_text.strip():
        return []

    query_vec = embed_text(query_text)

    if _pgvector_available():
        return _search_pgvector(repository_id, query_vec, top_k)
    else:
        return _search_python_cosine(repository_id, query_vec, top_k)


def _search_pgvector(repository_id: int, query_vec: list[float], top_k: int) -> list[dict]:
    """
    Database-side cosine distance search using pgvector.

    The <=> operator computes cosine *distance* (1 - similarity), so we convert:
        similarity = 1 - distance

    This never loads embeddings into Python memory; the database does all the work.
    """
    vec_literal = '[' + ','.join(str(v) for v in query_vec) + ']'

    sql = """
        SELECT
            id,
            file_path,
            symbol_name,
            symbol_type,
            start_line,
            end_line,
            content,
            1 - (embedding_vec <=> %s::vector) AS similarity
        FROM embeddings_codechunk
        WHERE repository_id = %s
          AND embedding_vec IS NOT NULL
          AND 1 - (embedding_vec <=> %s::vector) >= %s
        ORDER BY embedding_vec <=> %s::vector
        LIMIT %s
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, [vec_literal, repository_id, vec_literal, MIN_SIMILARITY, vec_literal, top_k])
            rows = cursor.fetchall()

        return [
            {
                'file_path': row[1],
                'symbol_name': row[2],
                'symbol_type': row[3],
                'start_line': row[4],
                'end_line': row[5],
                'content': row[6],
                'similarity': float(row[7]),
            }
            for row in rows
        ]
    except Exception as exc:
        logger.error('pgvector search failed: %s — falling back to Python', exc)
        return _search_python_cosine(repository_id, embed_text(''), top_k)


def _search_python_cosine(repository_id: int, query_vec: list[float], top_k: int) -> list[dict]:
    """
    Python-side cosine similarity fallback (used with SQLite in local dev).

    Loads all embeddings for the repository into memory and computes similarities.
    Acceptable for small repos; use pgvector for production scale.
    """
    chunks = CodeChunk.objects.filter(
        repository_id=repository_id,
        embedding__isnull=False,
    ).values('file_path', 'symbol_name', 'symbol_type', 'start_line', 'end_line', 'content', 'embedding')

    scored = []
    for chunk in chunks:
        emb = chunk['embedding']
        if not emb:
            continue
        sim = cosine_similarity(query_vec, emb)
        if sim >= MIN_SIMILARITY:
            scored.append((sim, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    return [
        {
            'file_path': c['file_path'],
            'symbol_name': c['symbol_name'],
            'symbol_type': c['symbol_type'],
            'start_line': c['start_line'],
            'end_line': c['end_line'],
            'content': c['content'],
            'similarity': float(sim),
        }
        for sim, c in top
    ]
