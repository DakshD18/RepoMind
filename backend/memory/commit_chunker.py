"""
Commit Chunker (Phase 3 — Repository Memory).

Builds structured embedding text from git commit data, similar to how
format_chunk_for_embedding() in parser/chunker.py produces structured text
for code chunks.

The structured format ensures that semantic search can match commits based on:
- Commit message content
- Author name
- File names changed
- Change type (modified, added, deleted)
"""


def format_commit_for_embedding(commit: dict, repo_name: str = '') -> str:
    """
    Build a structured embedding string for a single commit.

    Args:
        commit: Dict with keys: sha, author_name, committed_date, message, files_changed, stats.
        repo_name: Repository name for context.

    Returns:
        Structured text suitable for SentenceTransformer embedding.
    """
    sha = commit.get('sha', '')[:7]
    author = commit.get('author_name', 'Unknown')
    date = commit.get('committed_date', '')
    message = commit.get('message', '')
    files_changed = commit.get('files_changed', [])

    # Format date to YYYY-MM-DD if it's a full ISO datetime
    if isinstance(date, str) and len(date) > 10:
        date = date[:10]

    lines = []

    if repo_name:
        lines.append(f'Repository: {repo_name}')
    lines.append('Type: git_commit')
    lines.append(f'SHA: {sha}')
    lines.append(f'Author: {author}')
    lines.append(f'Date: {date}')
    lines.append('')
    lines.append('Commit Message:')
    lines.append(message.strip())

    if files_changed:
        lines.append('')
        lines.append('Files Changed:')
        for f in files_changed[:30]:  # Cap at 30 files to keep embedding text manageable
            filename = f.get('filename', '')
            status = f.get('status', 'modified')
            additions = f.get('additions', 0)
            deletions = f.get('deletions', 0)
            lines.append(f'- {filename} ({status}: +{additions} -{deletions})')

        total = len(files_changed)
        if total > 30:
            lines.append(f'... and {total - 30} more files')

    return '\n'.join(lines)
