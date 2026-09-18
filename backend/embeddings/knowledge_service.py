"""
Knowledge Service (Phase 2.1 — RAG Accuracy Upgrade).

Changes over Phase 2:
1. Two-stage hybrid retrieval (search_code_hybrid):
   - Stage 1: Retrieve RAG_RETRIEVAL_CANDIDATES (default 20) semantic candidates.
   - Stage 1b: Exact identifier/keyword search via DB ILIKE queries.
   - Merge and deduplicate into a unified candidate pool.
   The reranker (rag/reranker.py) then selects the best RAG_CONTEXT_TOP_K.

2. Configurable retrieval settings via environment variables:
   RAG_RETRIEVAL_CANDIDATES = 20  (semantic stage 1 count)
   RAG_CONTEXT_TOP_K        = 8   (final chunks after reranking)
   RAG_MIN_SIMILARITY       = 0.18

3. Keyword/identifier search on CodeChunk.symbol_name, class_name, file_path, content.

4. Embedding text (format_chunk_for_embedding) used for indexing so that structured
   metadata (file, class, function, type) is embedded alongside code.

5. Repository isolation: ALL queries are strictly scoped by repository_id.
   A query for Repository A NEVER retrieves chunks from Repository B.

6. search_code() preserved for backward compatibility (used in tests);
   internally delegates to the new hybrid pipeline.

pgvector Strategy
-----------------
We store embeddings as vector(384) columns (applied via raw SQL migration).
Vector search uses:
    ORDER BY embedding_vec <=> query_vec::vector
(pgvector's native cosine distance operator, fully in the database.)

SQLite Fallback
---------------
During local development with SQLite, pgvector is unavailable. Falls back to
Python-side cosine similarity using numpy.
"""

import logging
import os
import re

from django.conf import settings
from django.db import connection
from django.db.models import Q

from embeddings.models import CodeChunk
from embeddings.embedding_service import embed_text, embed_batch, cosine_similarity
from parser.chunker import chunk_repository, format_chunk_for_embedding

logger = logging.getLogger(__name__)

# ─── Configuration ─────────────────────────────────────────────────────────────

# Stage 1 semantic retrieval count
RAG_RETRIEVAL_CANDIDATES = int(os.getenv('RAG_RETRIEVAL_CANDIDATES', '20'))
# Final top-k after reranking (sent to Gemini context)
RAG_CONTEXT_TOP_K = int(os.getenv('RAG_CONTEXT_TOP_K', '8'))
# Minimum cosine similarity to include a candidate
MIN_SIMILARITY = float(os.getenv('RAG_MIN_SIMILARITY', '0.18'))
# Keyword search candidate count
KEYWORD_CANDIDATES = int(os.getenv('RAG_KEYWORD_CANDIDATES', '10'))

# Legacy alias used by old tests
DEFAULT_TOP_K = RAG_CONTEXT_TOP_K


# ─── DB Backend Detection ──────────────────────────────────────────────────────

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


# ─── Indexing ──────────────────────────────────────────────────────────────────

def index_repository(repository) -> None:
    """
    Parse the repository's cloned directory, generate embeddings for all code chunks,
    and persist them as CodeChunk records.

    Phase 2.1: Uses enriched embedding_text (file + class + function + code) from
    format_chunk_for_embedding() so that retrieval benefits from structured metadata.

    Called explicitly via POST /api/repositories/<id>/index/.
    NEVER called automatically from the chat endpoint.
    """
    from django.conf import settings as s

    repository.index_status = 'indexing'
    repository.index_error = ''
    repository.save(update_fields=['index_status', 'index_error'])

    try:
        repo_dir = str(s.CLONED_REPOS_DIR / f'{repository.owner}_{repository.name}_{repository.id}')
        logger.info('Indexing repository %s from %s', repository, repo_dir)

        # 1. Parse into chunks (enriched with embedding_text and class_name)
        chunks = chunk_repository(repo_dir, repo_name=repository.name)
        if not chunks:
            logger.warning('No chunks extracted from %s', repo_dir)

        # 2. Delete old chunks for this repository (clean re-index)
        deleted, _ = CodeChunk.objects.filter(repository=repository).delete()
        logger.info('Deleted %d stale chunks for repo %d', deleted, repository.id)

        # 3. Build embedding texts (use structured text, not raw code)
        embedding_texts = []
        for c in chunks:
            text = c.get('embedding_text') or format_chunk_for_embedding(c, repo_name=repository.name)
            embedding_texts.append(text)

        # 4. Embed in batches
        embeddings = embed_batch(embedding_texts)

        # 5. Persist
        batch_size = 200
        records = []
        for chunk, emb, emb_text in zip(chunks, embeddings, embedding_texts):
            records.append(CodeChunk(
                repository=repository,
                file_path=chunk['file_path'],
                symbol_name=chunk.get('symbol_name', ''),
                class_name=chunk.get('class_name', ''),
                symbol_type=chunk.get('symbol_type', 'block'),
                start_line=chunk['start_line'],
                end_line=chunk['end_line'],
                content=chunk['content'],
                embedding_text=emb_text,
                embedding=emb,
            ))
            if len(records) >= batch_size:
                CodeChunk.objects.bulk_create(records)
                records = []
        if records:
            CodeChunk.objects.bulk_create(records)

        total = CodeChunk.objects.filter(repository=repository).count()
        logger.info('Indexed %d chunks for repo %d', total, repository.id)

        # 6. If using PostgreSQL + pgvector, convert JSON → vector column
        if _is_postgres():
            _apply_pgvector_column(repository)

        # 7. Phase 3: Extract and embed commit history (non-blocking)
        try:
            from memory.services import index_commit_history
            index_commit_history(repository)
            logger.info('Commit history indexed for repo %d', repository.id)
        except Exception as exc:
            logger.warning('Commit history indexing failed for repo %d: %s (non-fatal)', repository.id, exc)

        # 8. Mark success
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


# ─── Keyword / Identifier Search ───────────────────────────────────────────────

def _extract_search_tokens(query: str) -> list[str]:
    """Tokenize query for keyword search; strips common English stopwords and expands concept synonyms."""
    _STOP = {
        'where', 'what', 'which', 'how', 'when', 'why', 'does', 'this', 'that', 'with',
        'from', 'into', 'used', 'using', 'use', 'uses',
        'defined', 'define', 'defines', 'defining', 'definition',
        'created', 'create', 'creates', 'creating', 'creation',
        'called', 'call', 'calls', 'calling',
        'find', 'show', 'list', 'explain', 'describe',
        'implement', 'implemented', 'implementing', 'implementation', 'implementations',
        'handle', 'handles', 'handled', 'handling', 'handler', 'handlers',
        'generate', 'generates', 'generated', 'generating', 'generation', 'generat',
        'function', 'functions', 'class', 'classes', 'method', 'methods',
        'file', 'files', 'module', 'modules', 'endpoint', 'endpoints', 'route', 'routes',
        'view', 'views', 'model', 'models', 'service', 'services', 'component', 'components',
        'page', 'pages', 'code', 'logic', 'work', 'works', 'working',
        'should', 'return', 'returns', 'returning',
        'repository', 'repo', 'project', 'application', 'app', 'system', 'data',
        'the', 'and', 'for', 'not', 'but', 'are', 'was', 'were', 'been',
        'have', 'has', 'had', 'about', 'some', 'there', 'their', 'them',
        'who', 'did', 'all', 'thid', 'teh',
    }

    tokens = set()
    for m in re.finditer(r'[a-zA-Z_][a-zA-Z0-9_]{2,}', query):
        w = m.group(0).lower()
        if w not in _STOP:
            tokens.add(w)

    valid_tokens = {t for t in tokens if len(t) >= 3}
    from rag.reranker import expand_concept_synonyms
    expanded = expand_concept_synonyms(valid_tokens)
    return list(expanded or valid_tokens)


def _keyword_search(repository_id: int, query: str, limit: int) -> list[dict]:
    """
    Retrieve chunks via exact/partial text matching on symbol_name, class_name,
    file_path, and content. Strictly scoped by repository_id.

    Returns chunk dicts with similarity=0.0 (will be evaluated by reranker).
    """
    from rag.reranker import detect_query_type, QueryType
    tokens = _extract_search_tokens(query)
    is_overview = (detect_query_type(query) == QueryType.OVERVIEW)

    if not tokens and not is_overview:
        return []

    # Build OR query across relevant fields
    filter_q = Q(repository_id=repository_id)
    text_q = Q()
    for token in tokens:
        text_q |= Q(symbol_name__icontains=token)
        text_q |= Q(class_name__icontains=token)
        text_q |= Q(file_path__icontains=token)

    # For small sets of meaningful query tokens, also match content
    raw_query_words = [
        w for w in re.findall(r'[a-zA-Z_][a-zA-Z0-9_]{2,}', query.lower())
        if w not in {'where', 'what', 'which', 'how', 'when', 'why', 'does', 'this', 'that', 'with', 'from', 'into', 'is', 'the', 'in', 'used', 'repo', 'project'}
    ]
    if raw_query_words and len(raw_query_words) <= 3:
        for rw in raw_query_words:
            text_q |= Q(content__icontains=rw)

    # For overview queries, also ensure root documentation and manifest files are in candidate pool
    if is_overview:
        doc_q = (
            Q(file_path__iexact='readme.md') |
            Q(file_path__icontains='readme') |
            Q(file_path__iexact='agents.md') |
            Q(file_path__iexact='package.json') |
            Q(file_path__iexact='pyproject.toml') |
            Q(file_path__iexact='requirements.txt') |
            Q(file_path__icontains='app.tsx') |
            Q(file_path__icontains='main.py') |
            Q(file_path__icontains='index.php') |
            Q(file_path__icontains='index.html') |
            Q(file_path__icontains='index.js')
        )
        text_q |= doc_q

    qs = (
        CodeChunk.objects
        .filter(filter_q & text_q)
        .exclude(file_path__iregex=r'\.(ctg\.z|z|otf|ttf|woff|woff2|eot|icc|ai|fdf)$')
        .values('id', 'file_path', 'symbol_name', 'class_name',
                'symbol_type', 'start_line', 'end_line', 'content')[:limit]
    )

    results = []
    for row in qs:
        results.append({
            'id': row['id'],
            'file_path': row['file_path'],
            'symbol_name': row['symbol_name'],
            'class_name': row['class_name'],
            'symbol_type': row['symbol_type'],
            'start_line': row['start_line'],
            'end_line': row['end_line'],
            'content': row['content'],
            'similarity': 0.0,
            'from_keyword': True,
        })

    return results


def _search_structural_candidates(repository_id: int, query: str, limit: int = 20) -> list[dict]:
    """
    Stage 1D — Deterministic Structural Candidate Injection:
    Guarantees that repository documentation, project manifests, and primary entry points
    reach the reranker for queries where standard semantic vector search or exact keyword
    matching might miss them.

    Query Types handled:
    - OVERVIEW: READMEs, package manifests, and root entry points.
    - ARCHITECTURE / MAIN LOGIC: Root entry points, controllers, routes, views, services
      (while excluding stylesheets and static non-code assets).
    - IMPLEMENTATION: Key domain modules (e.g. auth, api, db) and manifests for feature presence/absence.
    """
    from rag.reranker import (
        detect_query_type,
        QueryType,
        expand_concept_synonyms,
        extract_query_tokens,
        _FEATURE_USAGE_PHRASES,
    )

    q_type = detect_query_type(query)
    base_filter = Q(repository_id=repository_id)
    struct_q = Q()
    results = []

    if q_type == QueryType.OVERVIEW:
        struct_q = (
            Q(file_path__icontains='readme') |
            Q(file_path__iendswith='agents.md') |
            Q(file_path__iendswith='architecture.md') |
            Q(file_path__iendswith='package.json') |
            Q(file_path__iendswith='pyproject.toml') |
            Q(file_path__iendswith='requirements.txt') |
            Q(file_path__iendswith='pom.xml') |
            Q(file_path__iendswith='cargo.toml') |
            Q(file_path__iendswith='composer.json') |
            Q(file_path__icontains='app.tsx') |
            Q(file_path__icontains='app.jsx') |
            Q(file_path__icontains='app.js') |
            Q(file_path__icontains='main.py') |
            Q(file_path__icontains='server.js') |
            Q(file_path__icontains='index.php') |
            Q(file_path__icontains='manage.py')
        )
    elif q_type == QueryType.ARCHITECTURE:
        struct_q = (
            Q(file_path__icontains='main.py') |
            Q(file_path__icontains='server.js') |
            Q(file_path__icontains='app.py') |
            Q(file_path__icontains='app.jsx') |
            Q(file_path__icontains='app.tsx') |
            Q(file_path__icontains='index.php') |
            Q(file_path__icontains='manage.py') |
            Q(file_path__icontains='urls.py') |
            Q(file_path__icontains='routes') |
            Q(file_path__icontains='controllers') |
            Q(file_path__icontains='services') |
            Q(file_path__icontains='api/') |
            Q(file_path__icontains='admin-panel')
        )
    elif q_type == QueryType.IMPLEMENTATION:
        from rag.reranker import extract_core_entities
        entities = extract_core_entities(query)
        syns = expand_concept_synonyms(entities) if entities else set()
        for s in syns:
            if len(s) >= 3:
                struct_q |= Q(file_path__icontains=s)
                struct_q |= Q(symbol_name__icontains=s)

        # Manifest injection for feature queries
        if _FEATURE_USAGE_PHRASES.search(query) or any(w in query.lower() for w in ('used', 'use', 'exist', 'support')):
            manifest_q = (
                Q(file_path__iendswith='package.json') |
                Q(file_path__iendswith='pyproject.toml') |
                Q(file_path__iendswith='requirements.txt') |
                Q(file_path__iendswith='pom.xml') |
                Q(file_path__iendswith='composer.json')
            )
            manifest_qs = (
                CodeChunk.objects
                .filter(base_filter & manifest_q)
                .values('id', 'file_path', 'symbol_name', 'class_name',
                        'symbol_type', 'start_line', 'end_line', 'content')[:5]
            )
            for row in manifest_qs:
                results.append({
                    'id': row['id'],
                    'file_path': row['file_path'],
                    'symbol_name': row['symbol_name'],
                    'class_name': row['class_name'],
                    'symbol_type': row['symbol_type'],
                    'start_line': row['start_line'],
                    'end_line': row['end_line'],
                    'content': row['content'],
                    'similarity': 0.0,
                    'from_structural': True,
                })
    else:
        return []

    if not struct_q:
        return results

    # Exclude binaries, stylesheets, font files, and test/skill dirs from structural injection
    qs = (
        CodeChunk.objects
        .filter(base_filter & struct_q)
        .exclude(file_path__iregex=r'\.(ctg\.z|z|otf|ttf|woff|woff2|eot|icc|ai|fdf|css|scss|less|map|md)$')
        .exclude(file_path__icontains='skill-creator/')
        .exclude(file_path__icontains='.agents/')
        .values('id', 'file_path', 'symbol_name', 'class_name',
                'symbol_type', 'start_line', 'end_line', 'content')[:limit]
    )

    for row in qs:
        results.append({
            'id': row['id'],
            'file_path': row['file_path'],
            'symbol_name': row['symbol_name'],
            'class_name': row['class_name'],
            'symbol_type': row['symbol_type'],
            'start_line': row['start_line'],
            'end_line': row['end_line'],
            'content': row['content'],
            'similarity': 0.0,
            'from_structural': True,
        })
    return results


# ─── Vector Search ─────────────────────────────────────────────────────────────

def _search_pgvector(repository_id: int, query_vec: list[float], limit: int) -> list[dict]:
    """
    Database-side cosine distance search using pgvector.
    similarity = 1 - cosine_distance (using <=> operator).
    Filters out binary font assets and prioritizes core application code over vendor chunks.
    """
    vec_literal = '[' + ','.join(str(v) for v in query_vec) + ']'

    sql = """
        SELECT
            id,
            file_path,
            symbol_name,
            class_name,
            symbol_type,
            start_line,
            end_line,
            content,
            1 - (embedding_vec <=> %s::vector) AS similarity
        FROM embeddings_codechunk
        WHERE repository_id = %s
          AND embedding_vec IS NOT NULL
          AND file_path NOT ILIKE '%%.ctg.z'
          AND file_path NOT ILIKE '%%.otf'
          AND file_path NOT ILIKE '%%.z'
          AND file_path NOT ILIKE '%%.ttf'
          AND file_path NOT ILIKE '%%.woff'
          AND 1 - (embedding_vec <=> %s::vector) >= %s
        ORDER BY
          CASE WHEN file_path ILIKE '%%tcpdf%%' OR file_path ILIKE '%%font-awesome%%' THEN 1 ELSE 0 END ASC,
          embedding_vec <=> %s::vector ASC
        LIMIT %s
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, [vec_literal, repository_id, vec_literal, MIN_SIMILARITY, vec_literal, limit])
            rows = cursor.fetchall()

        return [
            {
                'id': row[0],
                'file_path': row[1],
                'symbol_name': row[2],
                'class_name': row[3],
                'symbol_type': row[4],
                'start_line': row[5],
                'end_line': row[6],
                'content': row[7],
                'similarity': float(row[8]),
            }
            for row in rows
        ]
    except Exception as exc:
        logger.error('pgvector search failed: %s — falling back to Python', exc)
        return _search_python_cosine(repository_id, query_vec, limit)


def _search_python_cosine(repository_id: int, query_vec: list[float], limit: int) -> list[dict]:
    """
    Python-side cosine similarity fallback (used with SQLite in local dev).
    Loads embeddings for the repository, excluding binary font assets,
    and prioritizing application code over vendor code.
    """
    chunks = (
        CodeChunk.objects
        .filter(repository_id=repository_id, embedding__isnull=False)
        .exclude(file_path__iregex=r'\.(ctg\.z|z|otf|ttf|woff|woff2|eot|icc|ai|fdf)$')
        .values('id', 'file_path', 'symbol_name', 'class_name',
                'symbol_type', 'start_line', 'end_line', 'content', 'embedding')
    )

    scored = []
    for chunk in chunks:
        emb = chunk['embedding']
        if not emb:
            continue
        sim = cosine_similarity(query_vec, emb)
        if sim >= MIN_SIMILARITY:
            scored.append((sim, chunk))

    # Sort: non-vendor files first, then highest similarity
    def _sort_key(item):
        sim, c = item
        fp = c.get('file_path', '').lower()
        is_vendor = 1 if ('tcpdf' in fp or 'font-awesome' in fp) else 0
        return (is_vendor, -sim)

    scored.sort(key=_sort_key)

    return [
        {
            'id': c['id'],
            'file_path': c['file_path'],
            'symbol_name': c['symbol_name'],
            'class_name': c['class_name'],
            'symbol_type': c['symbol_type'],
            'start_line': c['start_line'],
            'end_line': c['end_line'],
            'content': c['content'],
            'similarity': float(sim),
        }
        for sim, c in scored[:limit]
    ]


# ─── Commit Memory Search (Phase 3) ────────────────────────────────────────────

def _search_pgvector_commits(repository_id: int, query_vec: list[float], limit: int) -> list[tuple[float, dict]]:
    """
    Database-side cosine distance search for commit memories using pgvector.
    similarity = 1 - cosine_distance (using <=> operator).
    """
    vec_literal = '[' + ','.join(str(v) for v in query_vec) + ']'
    sql = """
        SELECT
            id,
            commit_sha,
            author_name,
            author_email,
            committed_date,
            message,
            files_changed,
            stats,
            1 - (embedding_vec <=> %s::vector) AS similarity
        FROM memory_commitmemory
        WHERE repository_id = %s
          AND embedding_vec IS NOT NULL
          AND 1 - (embedding_vec <=> %s::vector) >= %s
        ORDER BY embedding_vec <=> %s::vector
        LIMIT %s
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, [vec_literal, repository_id, vec_literal, MIN_SIMILARITY, vec_literal, limit])
            rows = cursor.fetchall()

        results = []
        for row in rows:
            cm = {
                'id': row[0],
                'commit_sha': row[1],
                'author_name': row[2],
                'author_email': row[3],
                'committed_date': row[4],
                'message': row[5],
                'files_changed': row[6],
                'stats': row[7],
            }
            results.append((float(row[8]), cm))
        return results
    except Exception as exc:
        logger.warning('pgvector commit search failed: %s — falling back to Python', exc)
        return []


def _search_commit_memory(
    repository_id: int,
    query_text: str,
    query_vec: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Search CommitMemory records by deterministic temporal recency, SHA matching,
    vector similarity, and keyword matching.
    Uses PostgreSQL/pgvector when available, with fallback to Python-side similarity.
    Returns results formatted as chunk-like dicts with symbol_type='commit'
    so they flow through the existing reranker and context builder.
    """
    try:
        from memory.models import CommitMemory
        from repositories.models import Repository
        from rag.reranker import is_recency_query, is_initial_commit_query, extract_commit_sha
    except ImportError:
        return []

    # Check repository URL / GitHub link
    repo = Repository.objects.filter(id=repository_id).only('url', 'owner', 'name').first()
    repo_url = repo.url.rstrip('/') if repo and repo.url else ''
    if not repo_url and repo and repo.owner and repo.name:
        repo_url = f"https://github.com/{repo.owner}/{repo.name}"

    scored: list[tuple[float, dict]] = []
    seen_commit_ids: set[int] = set()

    # 1. Deterministic Temporal Recency: "last commit", "latest commit", "most recent commit"
    if is_recency_query(query_text):
        recent_commits = list(
            CommitMemory.objects.filter(repository_id=repository_id)
            .order_by('-committed_date')
            .values(
                'id', 'commit_sha', 'author_name', 'author_email',
                'committed_date', 'message', 'files_changed', 'stats',
                'embedding',
            )[:limit]
        )
        for i, cm in enumerate(recent_commits):
            sim = max(0.98 - 0.03 * i, 0.85)
            cm['is_recency'] = True
            scored.append((sim, cm))
            seen_commit_ids.add(cm['id'])

    # 2. Initial / first commit queries
    elif is_initial_commit_query(query_text):
        initial_commits = list(
            CommitMemory.objects.filter(repository_id=repository_id)
            .order_by('committed_date')
            .values(
                'id', 'commit_sha', 'author_name', 'author_email',
                'committed_date', 'message', 'files_changed', 'stats',
                'embedding',
            )[:limit]
        )
        for i, cm in enumerate(initial_commits):
            sim = max(0.98 - 0.03 * i, 0.85)
            cm['is_initial'] = True
            scored.append((sim, cm))
            seen_commit_ids.add(cm['id'])

    # 3. Explicit commit SHA in query: "when was commit X", "commit X"
    target_sha = extract_commit_sha(query_text)
    if target_sha:
        sha_commits = list(
            CommitMemory.objects.filter(
                repository_id=repository_id,
                commit_sha__istartswith=target_sha,
            ).values(
                'id', 'commit_sha', 'author_name', 'author_email',
                'committed_date', 'message', 'files_changed', 'stats',
                'embedding',
            )[:limit]
        )
        for cm in sha_commits:
            if cm['id'] not in seen_commit_ids:
                cm['is_exact_sha'] = True
                scored.insert(0, (0.99, cm))
                seen_commit_ids.add(cm['id'])

    # 4. Semantic vector search (for general historical questions or entity search)
    # Try pgvector first if available
    if _pgvector_available():
        pg_scored = _search_pgvector_commits(repository_id, query_vec, limit)
        for sim, cm in pg_scored:
            if cm['id'] not in seen_commit_ids:
                scored.append((sim, cm))
                seen_commit_ids.add(cm['id'])
    else:
        commits = CommitMemory.objects.filter(
            repository_id=repository_id,
            embedding__isnull=False,
        ).exclude(id__in=seen_commit_ids).values(
            'id', 'commit_sha', 'author_name', 'author_email',
            'committed_date', 'message', 'files_changed', 'stats',
            'embedding',
        )

        vector_scored = []
        for cm in commits:
            emb = cm.get('embedding')
            if not emb:
                continue
            sim = cosine_similarity(query_vec, emb)
            if sim >= MIN_SIMILARITY:
                vector_scored.append((sim, cm))

        vector_scored.sort(key=lambda x: x[0], reverse=True)
        for sim, cm in vector_scored[:limit]:
            scored.append((sim, cm))
            seen_commit_ids.add(cm['id'])

    # 5. Keyword matching on commit messages and file names
    tokens = _extract_search_tokens(query_text)
    if tokens:
        kw_q = Q(repository_id=repository_id)
        text_q = Q()
        for token in tokens:
            text_q |= Q(message__icontains=token)
            text_q |= Q(author_name__icontains=token)
        keyword_commits = CommitMemory.objects.filter(
            kw_q & text_q
        ).exclude(id__in=seen_commit_ids).values(
            'id', 'commit_sha', 'author_name', 'author_email',
            'committed_date', 'message', 'files_changed', 'stats',
            'embedding',
        )[:limit]
        for cm in keyword_commits:
            scored.append((0.0, cm))
            seen_commit_ids.add(cm['id'])

    # Build chunk-like dicts for the top results
    results = []
    for sim, cm in scored[:limit]:
        # Build content string from commit data
        files_str = ''
        if cm.get('files_changed'):
            file_lines = []
            for f in cm['files_changed'][:20]:
                file_lines.append(
                    f"- {f.get('filename', '')} ({f.get('status', 'modified')}: "
                    f"+{f.get('additions', 0)} -{f.get('deletions', 0)})"
                )
            files_str = '\n'.join(file_lines)

        committed_date_str = ''
        if cm.get('committed_date'):
            committed_date_str = cm['committed_date'].isoformat() if hasattr(cm['committed_date'], 'isoformat') else str(cm['committed_date'])

        commit_url = f"{repo_url}/commit/{cm['commit_sha']}" if repo_url else ""

        content = f"Commit {cm['commit_sha']} ({cm['commit_sha'][:7]}) by {cm['author_name']}\n"
        content += f"Date: {committed_date_str}\n"
        if commit_url:
            content += f"GitHub Link: {commit_url}\n"
        content += f"\n{cm['message']}\n"
        if files_str:
            content += f"\nFiles Changed:\n{files_str}"

        results.append({
            'id': cm['id'],
            'file_path': f"commit:{cm['commit_sha'][:7]}",
            'symbol_name': cm['commit_sha'][:7],
            'class_name': '',
            'symbol_type': 'commit',
            'start_line': 0,
            'end_line': 0,
            'content': content,
            'similarity': float(sim),
            # Phase 3 commit-specific fields
            'commit_sha': cm['commit_sha'],
            'author_name': cm['author_name'],
            'committed_date': committed_date_str,
            'commit_url': commit_url,
            'is_recency': cm.get('is_recency', False),
            'is_initial': cm.get('is_initial', False),
            'is_exact_sha': cm.get('is_exact_sha', False),
        })

    return results


# ─── Hybrid Retrieval ──────────────────────────────────────────────────────────

def search_code_hybrid(
    repository_id: int,
    query_text: str,
    n_candidates: int = RAG_RETRIEVAL_CANDIDATES,
    top_k: int = RAG_CONTEXT_TOP_K,
    return_meta: bool = False,
) -> tuple[list[dict], dict] | list[dict]:
    """
    Four-stage hybrid retrieval:

    Stage 1A — Semantic vector search: retrieve n_candidates code chunks.
    Stage 1B — Keyword/identifier search: retrieve KEYWORD_CANDIDATES code chunks.
    Stage 1C — Commit memory search: retrieve commit history matches (Phase 3).
    Stage 1D — Structural candidate injection: retrieve entry points, docs, and manifests.

    Merge + deduplicate by chunk id.

    Returns the merged candidate pool (before reranking).
    The reranker (rag/reranker.py) selects the final top_k.

    All queries are strictly scoped to repository_id.
    """
    if not query_text.strip():
        meta = {
            'query_vec': [],
            'semantic_count': 0,
            'keyword_count': 0,
            'commit_count': 0,
            'structural_count': 0,
            'total_candidates': 0,
        }
        return ([], meta) if return_meta else []

    # Stage 1A: Semantic vector search
    query_vec = embed_text(query_text)

    if _pgvector_available():
        semantic_results = _search_pgvector(repository_id, query_vec, n_candidates)
    else:
        semantic_results = _search_python_cosine(repository_id, query_vec, n_candidates)

    # Stage 1B: Keyword / identifier search
    keyword_results = _keyword_search(repository_id, query_text, KEYWORD_CANDIDATES)

    # Stage 1C: Commit memory search (Phase 3)
    commit_results = _search_commit_memory(repository_id, query_text, query_vec, limit=5)

    # Stage 1D: Structural candidate injection
    structural_results = _search_structural_candidates(repository_id, query_text, limit=15)

    # Merge: semantic results take priority; keyword/structural results fill in missing chunks
    seen_ids: set = set()
    merged: list[dict] = []

    for chunk in semantic_results:
        cid = chunk.get('id')
        if cid not in seen_ids:
            seen_ids.add(cid)
            merged.append(chunk)

    for chunk in keyword_results:
        cid = chunk.get('id')
        if cid not in seen_ids:
            seen_ids.add(cid)
            merged.append(chunk)

    for chunk in structural_results:
        cid = chunk.get('id')
        if cid not in seen_ids:
            seen_ids.add(cid)
            merged.append(chunk)
        else:
            # Mark existing chunk as structural match
            for m in merged:
                if m.get('id') == cid:
                    m['from_structural'] = True
                    break

    # Add commit results with prefixed IDs to avoid collision with code chunk IDs
    for chunk in commit_results:
        cid = f"commit-{chunk.get('id')}"
        if cid not in seen_ids:
            seen_ids.add(cid)
            merged.append(chunk)

    meta = {
        'query_vec': query_vec,
        'semantic_count': len(semantic_results),
        'keyword_count': len(keyword_results),
        'commit_count': len(commit_results),
        'structural_count': len(structural_results),
        'total_candidates': len(merged),
    }

    logger.debug(
        'Hybrid retrieval: repo=%d  semantic=%d  keyword=%d  commits=%d  structural=%d  total=%d',
        repository_id, len(semantic_results), len(keyword_results), len(commit_results), len(structural_results), len(merged),
    )
    if return_meta:
        return merged, meta
    return merged


# ─── Public API (backward-compatible) ─────────────────────────────────────────

def search_code(
    repository_id: int,
    query_text: str,
    top_k: int = DEFAULT_TOP_K,
    return_all_evaluated: bool = False,
    return_retrieval_meta: bool = False,
):
    """
    Backward-compatible retrieval function.

    Delegates to hybrid retrieval + absolute relevance reranking internally.
    Returns top_k chunks that successfully passed absolute relevance gating.

    Args:
        repository_id: Strictly scoped repository ID.
        query_text: Natural-language question or search string.
        top_k: Final number of chunks to return.
        return_all_evaluated: If True, returns tuple (accepted_top_k, all_evaluated_candidates)
                              for diagnostic/debug purposes.
        return_retrieval_meta: If True, also includes retrieval stage counts and query vector.

    Returns:
        List of chunk dicts or tuple depending on flags.
    """
    from rag.reranker import rerank

    hybrid_out = search_code_hybrid(
        repository_id=repository_id,
        query_text=query_text,
        n_candidates=RAG_RETRIEVAL_CANDIDATES,
        top_k=top_k,
        return_meta=True,
    )
    candidates, meta = hybrid_out

    if not candidates:
        if return_retrieval_meta:
            return ([], [], meta) if return_all_evaluated else ([], meta)
        return ([], []) if return_all_evaluated else []

    rerank_out = rerank(
        candidates,
        query=query_text,
        top_k=top_k,
        return_all_evaluated=return_all_evaluated or return_retrieval_meta,
    )

    if return_all_evaluated or return_retrieval_meta:
        accepted, evaluated = rerank_out
        if return_retrieval_meta:
            return accepted, evaluated, meta
        return accepted, evaluated

    return rerank_out
