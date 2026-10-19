"""
Memory Services (Phase 3 — Repository Memory).

Fetches commit history from the public GitHub REST API and indexes it
as CommitMemory records with vector embeddings for RAG retrieval.

Key design decisions:
- Configurable maximum commits via REPO_MEMORY_MAX_COMMITS (defaults to 250).
- Paginated GitHub commit history fetching supporting repositories of any size.
- Incremental indexing: detects the last indexed commit and primarily ingests
  new commits, without deleting prior history.
- Rate limit resilience: inspects GitHub rate limit headers and handles 403/429
  gracefully without failing the primary repository indexing pipeline.
- Retry logic with backoff for transient network issues.
- Generates embeddings in batches using the shared 384-dim all-MiniLM-L6-v2 model.
- Persists to PostgreSQL/pgvector when available, with clean fallback.
- Extensible design ready for background processing (e.g. Celery) without
  introducing unneeded infrastructure in this phase.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from memory.models import CommitMemory
from memory.commit_chunker import format_commit_for_embedding
from embeddings.embedding_service import embed_batch

logger = logging.getLogger(__name__)

# Maximum commits to fetch per repository (configurable via environment)
REPO_MEMORY_MAX_COMMITS = int(
    os.getenv('REPO_MEMORY_MAX_COMMITS', os.getenv('MEMORY_MAX_COMMITS', '250'))
)

# Delay between individual commit detail requests (seconds)
MEMORY_DETAIL_DELAY = float(os.getenv('MEMORY_DETAIL_DELAY', '0.1'))

# GitHub API page size (max allowed by GitHub is 100)
GITHUB_PER_PAGE = int(os.getenv('GITHUB_PER_PAGE', '100'))

GITHUB_API_BASE = 'https://api.github.com'

# Optional GitHub token for higher rate limits (5,000 req/hr vs 60 req/hr)
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '').strip()


def _github_headers() -> dict:
    """Build headers for GitHub API requests."""
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RepoMind/1.0',
    }
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'
    return headers


def _get_github_session() -> requests.Session:
    """Create a requests Session configured with retries and exponential backoff."""
    session = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    return session


def _is_rate_limited(resp: requests.Response) -> bool:
    """Check if a response indicates GitHub rate limiting."""
    if resp.status_code in (403, 429):
        return True
    remaining = resp.headers.get('X-RateLimit-Remaining')
    if remaining is not None and remaining.isdigit() and int(remaining) == 0:
        return True
    return False


def _parse_commit_date(date_str: str) -> datetime:
    """Parse GitHub API date string to timezone-aware datetime."""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return datetime.now(timezone.utc)


def fetch_commit_history(
    repository,
    stop_at_shas: Optional[set] = None,
    since: Optional[datetime] = None,
    max_commits: Optional[int] = None,
) -> list[dict]:
    """
    Fetch commit history from the GitHub API using pagination and incremental detection.

    Args:
        repository: Repository model instance with .owner and .name.
        stop_at_shas: Set of commit SHAs already indexed; pagination halts early
                      when encountering a commit in this set.
        since: Only fetch commits newer than this datetime (optional filter).
        max_commits: Maximum commits to ingest in this run.

    Returns:
        List of commit dicts with: sha, author_name, author_email,
        committed_date, message, files_changed, stats.
    """
    owner = repository.owner
    name = repository.name
    target_limit = max_commits or REPO_MEMORY_MAX_COMMITS
    stop_shas = stop_at_shas or set()

    session = _get_github_session()
    headers = _github_headers()

    list_url = f'{GITHUB_API_BASE}/repos/{owner}/{name}/commits'
    page = 1
    collected_commits: list[dict] = []
    stop_reached = False

    logger.info(
        'Fetching commits for %s/%s (limit=%d, incremental=%s, stop_shas_count=%d)',
        owner, name, target_limit, bool(stop_shas), len(stop_shas)
    )

    # ─── Paginated Commit List Fetching ──────────────────────────────────────
    while len(collected_commits) < target_limit and not stop_reached:
        per_page = min(GITHUB_PER_PAGE, target_limit - len(collected_commits))
        params: dict = {
            'per_page': per_page,
            'page': page,
        }
        if since:
            params['since'] = since.isoformat()

        try:
            resp = session.get(list_url, params=params, headers=headers, timeout=20)
        except requests.RequestException as exc:
            logger.error('GitHub API request failed for %s/%s page %d: %s', owner, name, page, exc)
            break

        if _is_rate_limited(resp):
            logger.warning('GitHub API rate limit hit while listing commits for %s/%s at page %d', owner, name, page)
            break

        if resp.status_code == 404:
            logger.warning('GitHub repository not found or private: %s/%s', owner, name)
            break

        if resp.status_code != 200:
            logger.warning('Unexpected GitHub API status %d for %s/%s page %d', resp.status_code, owner, name, page)
            break

        items = resp.json()
        if not isinstance(items, list) or not items:
            # Reached end of commit history
            break

        for item in items:
            sha = item.get('sha', '')
            if not sha:
                continue

            # Incremental check: halt pagination once we encounter a commit we already indexed
            if sha in stop_shas:
                logger.info('Encountered previously indexed commit %s; stopping pagination', sha[:7])
                stop_reached = True
                break

            commit_data = item.get('commit', {})
            author_info = commit_data.get('author', {})
            committer_info = commit_data.get('committer', {})

            collected_commits.append({
                'sha': sha,
                'author_name': author_info.get('name', 'Unknown'),
                'author_email': author_info.get('email', ''),
                'committed_date': committer_info.get('date', ''),
                'message': commit_data.get('message', ''),
                'files_changed': [],
                'stats': {},
            })

            if len(collected_commits) >= target_limit:
                break

        if len(items) < per_page:
            # Last page of commits reached
            break

        page += 1

    logger.info('Discovered %d new commits from GitHub for %s/%s', len(collected_commits), owner, name)

    # ─── Fallback: Local Git Clone for private repositories or API limits ───
    if not collected_commits:
        from django.conf import settings as s
        import git
        clone_dir = s.CLONED_REPOS_DIR / f'{owner}_{name}_{repository.id}'
        if os.path.exists(clone_dir):
            try:
                git_repo = git.Repo(clone_dir)
                try:
                    if os.path.exists(os.path.join(clone_dir, '.git', 'shallow')):
                        git_repo.git.fetch('--unshallow')
                except Exception:
                    pass

                for c in git_repo.iter_commits(max_count=target_limit):
                    sha = c.hexsha
                    if sha in stop_shas:
                        break

                    commit_dt = c.committed_datetime
                    if since and commit_dt <= since:
                        break

                    files_changed = []
                    stats_dict = {}
                    try:
                        c_stats = c.stats
                        for fname, st in c_stats.files.items():
                            files_changed.append({
                                'filename': fname,
                                'status': 'modified',
                                'additions': st.get('insertions', 0),
                                'deletions': st.get('deletions', 0),
                            })
                        stats_dict = {
                            'total_additions': c_stats.total.get('insertions', 0),
                            'total_deletions': c_stats.total.get('deletions', 0),
                            'files_changed_count': c_stats.total.get('files', 0),
                        }
                    except Exception:
                        pass

                    collected_commits.append({
                        'sha': sha,
                        'author_name': c.author.name or 'Unknown',
                        'author_email': c.author.email or '',
                        'committed_date': commit_dt.isoformat(),
                        'message': c.message or '',
                        'files_changed': files_changed,
                        'stats': stats_dict,
                    })

                logger.info(
                    'Extracted %d commits from local Git repository clone for %s/%s',
                    len(collected_commits), owner, name
                )
                return collected_commits
            except Exception as err:
                logger.warning('Failed reading commits from local clone for %s/%s: %s', owner, name, err)

    # ─── Selective File Detail Fetching (batched & rate-limit aware) ──────────
    detail_count = 0
    for commit in collected_commits:
        sha = commit['sha']
        detail_url = f'{GITHUB_API_BASE}/repos/{owner}/{name}/commits/{sha}'

        try:
            detail_resp = session.get(detail_url, headers=headers, timeout=15)
            if _is_rate_limited(detail_resp):
                logger.warning('Rate limit hit during detail fetch at commit %d; proceeding with basic metadata', detail_count)
                break

            if detail_resp.status_code == 200:
                detail = detail_resp.json()
                if isinstance(detail, dict):
                    files = detail.get('files', [])
                    stats = detail.get('stats', {})

                    commit['files_changed'] = [
                        {
                            'filename': f.get('filename', ''),
                            'status': f.get('status', 'modified'),
                            'additions': f.get('additions', 0),
                            'deletions': f.get('deletions', 0),
                        }
                        for f in files
                    ]
                    commit['stats'] = {
                        'total_additions': stats.get('additions', 0),
                        'total_deletions': stats.get('deletions', 0),
                        'files_changed_count': len(files),
                    }

            detail_count += 1
            if detail_count < len(collected_commits) and MEMORY_DETAIL_DELAY > 0:
                time.sleep(MEMORY_DETAIL_DELAY)

        except requests.RequestException as exc:
            logger.warning('Detail fetch failed for commit %s: %s (using commit message only)', sha[:7], exc)
            continue

    return collected_commits


def index_commit_history(
    repository,
    max_commits: Optional[int] = None,
    incremental: bool = True,
) -> int:
    """
    Fetch commit history from GitHub, build embedding text for new commits,
    generate embeddings in batches, and persist as CommitMemory records.

    Key behaviors:
    - Incremental: checks already indexed SHAs and only ingests new commits.
    - Does NOT delete prior CommitMemory history on re-index.
    - Embeds in batches to optimize throughput and memory usage.
    - Updates pgvector columns where PostgreSQL is active.

    Args:
        repository: Repository model instance.
        max_commits: Override maximum commits to ingest (default: REPO_MEMORY_MAX_COMMITS).
        incremental: If True, preserves existing commits and only ingests newer ones.

    Returns:
        Number of newly indexed commits.
    """
    from django.conf import settings

    logger.info('Starting commit history indexing for repo %d (%s/%s)',
                repository.id, repository.owner, repository.name)

    # 1. Inspect existing commit history for incremental indexing
    existing_shas: set = set()
    latest_date: Optional[datetime] = None

    if incremental:
        existing_shas = set(
            CommitMemory.objects.filter(repository=repository).values_list('commit_sha', flat=True)
        )
        latest_commit = CommitMemory.objects.filter(repository=repository).order_by('-committed_date').first()
        if latest_commit:
            latest_date = latest_commit.committed_date
    else:
        deleted, _ = CommitMemory.objects.filter(repository=repository).delete()
        if deleted:
            logger.info('Full re-index: deleted %d stale CommitMemory records for repo %d', deleted, repository.id)

    # 2. Fetch commits from GitHub
    commits = fetch_commit_history(
        repository,
        stop_at_shas=existing_shas,
        since=latest_date if (incremental and latest_date) else None,
        max_commits=max_commits or REPO_MEMORY_MAX_COMMITS,
    )

    # Filter out any duplicate SHAs that might have slipped through
    new_commits = [c for c in commits if c['sha'] not in existing_shas]

    if not new_commits:
        total_existing = len(existing_shas)
        logger.info('Repo %d commit history is already up to date (%d commits in memory)', repository.id, total_existing)
        return 0

    logger.info('Indexing %d new commits for repo %d', len(new_commits), repository.id)

    # 3. Build embedding texts
    embedding_texts = [
        format_commit_for_embedding(c, repo_name=repository.name)
        for c in new_commits
    ]

    # 4. Generate embeddings in batches (optional enhancement for semantic search)
    BATCH_SIZE = 64
    all_embeddings: list = []
    try:
        for i in range(0, len(embedding_texts), BATCH_SIZE):
            batch_slice = embedding_texts[i:i + BATCH_SIZE]
            batch_embeddings = embed_batch(batch_slice)
            all_embeddings.extend(batch_embeddings)
    except Exception as emb_exc:
        logger.warning('Embedding generation failed or skipped: %s; proceeding without vectors', emb_exc)
        all_embeddings = [None] * len(new_commits)

    # Ensure embeddings length matches commits
    if len(all_embeddings) < len(new_commits):
        all_embeddings.extend([None] * (len(new_commits) - len(all_embeddings)))

    # 5. Persist CommitMemory records
    records = []
    for commit, emb, emb_text in zip(new_commits, all_embeddings, embedding_texts):
        records.append(CommitMemory(
            repository=repository,
            commit_sha=commit['sha'],
            author_name=commit['author_name'],
            author_email=commit['author_email'],
            committed_date=_parse_commit_date(commit['committed_date']),
            message=commit['message'],
            files_changed=commit['files_changed'],
            stats=commit['stats'],
            embedding_text=emb_text,
            embedding=emb,
        ))

    # Bulk create with conflict handling on (repository, commit_sha)
    CommitMemory.objects.bulk_create(records, batch_size=200, ignore_conflicts=True)
    new_count = len(records)
    total_count = CommitMemory.objects.filter(repository=repository).count()
    logger.info('Indexed %d new commits (total %d in memory) for repo %d', new_count, total_count, repository.id)

    # 6. Apply PostgreSQL / pgvector column update if active
    engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    if 'postgresql' in engine or 'postgis' in engine:
        _apply_pgvector_column_commits(repository)

    return new_count


def _apply_pgvector_column_commits(repository) -> None:
    """
    Ensure the pgvector column exists and populate it for newly inserted commits.
    Uses native vector(384) cast on PostgreSQL.
    """
    from django.db import connection

    try:
        with connection.cursor() as cursor:
            # Verify pgvector extension is available
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            if cursor.fetchone() is None:
                return

            # Ensure embedding_vec column exists on memory_commitmemory table
            cursor.execute(
                "ALTER TABLE memory_commitmemory ADD COLUMN IF NOT EXISTS embedding_vec vector(384);"
            )

            # Update only rows that do not have embedding_vec populated yet
            cursor.execute(
                """
                UPDATE memory_commitmemory
                SET embedding_vec = embedding::text::vector
                WHERE repository_id = %s AND embedding_vec IS NULL
                """,
                [repository.id],
            )
        logger.info('pgvector column updated for new commit memories of repo %d', repository.id)
    except Exception as exc:
        logger.warning('pgvector column update skipped for commit memories: %s', exc)


def task_index_commit_history(
    repository_id: int,
    max_commits: Optional[int] = None,
    incremental: bool = True,
) -> dict:
    """
    Task-ready entry point for background processing (Celery / RQ / background threads).
    Compatible with current Django setup and ready for future async worker infrastructure.

    Args:
        repository_id: ID of the Repository to index.
        max_commits: Optional limit on commits to fetch.
        incremental: Whether to run incremental indexing (default True).

    Returns:
        Dict with status and new_commits count.
    """
    from repositories.models import Repository

    try:
        repo = Repository.objects.get(id=repository_id)
        new_indexed = index_commit_history(repo, max_commits=max_commits, incremental=incremental)
        return {'status': 'success', 'repository_id': repository_id, 'new_commits': new_indexed}
    except Exception as exc:
        logger.exception('task_index_commit_history failed for repo %d: %s', repository_id, exc)
        return {'status': 'failed', 'repository_id': repository_id, 'error': str(exc)}
