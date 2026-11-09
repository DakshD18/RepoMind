"""
Parser Services — Core logic for cloning repositories and extracting metadata.
"""

import os
import shutil
import re
from pathlib import Path
from datetime import datetime, timezone
import git


# Map of common file extensions to language names
EXTENSION_LANGUAGE_MAP = {
    '.py': 'Python',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.go': 'Go',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.json': 'JSON',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.md': 'Markdown',
    '.sh': 'Shell',
    '.sql': 'SQL',
    '.r': 'R',
    '.dart': 'Dart',
    '.vue': 'Vue',
}

# Directories to skip during scanning
SKIP_DIRS = {
    '.git', 'node_modules', '__pycache__', '.venv', 'venv',
    '.env', 'dist', 'build', '.next', '.cache', 'vendor',
}


def clone_repository(repo_url: str, target_dir: str, token: str | None = None) -> git.Repo:
    """
    Clones a GitHub repository to the given target directory.
    Uses a shallow clone (depth=1) for performance.
    Removes the existing directory first if it already exists.
    Supports private repositories if a GitHub token is provided or set in environment (GITHUB_TOKEN / GITHUB_PAT).
    """
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)

    raw_token = token or os.getenv('GITHUB_TOKEN') or os.getenv('GITHUB_PAT')
    github_token = raw_token.strip() if raw_token else None

    clone_url = repo_url.strip()
    if github_token and 'github.com' in clone_url:
        clean_url = re.sub(r'https://[^@]+@github\.com/', 'https://github.com/', clone_url)
        clone_url = re.sub(r'^https://github\.com/', f'https://{github_token}@github.com/', clean_url)

    # Disable terminal prompt so Git fails immediately instead of hanging or prompting for credentials
    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'

    try:
        repo = git.Repo.clone_from(clone_url, target_dir, depth=1, env=env)
        return repo
    except git.exc.GitCommandError as e:
        error_msg = str(e)
        # Scrub token from error message so it is never exposed in logs or user toasts
        if github_token:
            error_msg = error_msg.replace(github_token, '***')

        lower_err = error_msg.lower()
        if any(term in lower_err for term in [
            'could not read username',
            'authentication failed',
            'repository not found',
            'not found',
            'terminal prompts disabled',
            'device or address',
            'bad credentials',
        ]):
            if github_token:
                raise ValueError(
                    "Authentication failed. Please verify that your GitHub Personal Access Token is valid "
                    "and has read permissions ('repo' or 'contents:read') for this repository."
                ) from e
            else:
                raise ValueError(
                    "This repository appears to be private or does not exist. "
                    "If this is a private repository, please expand the 'Private Repository' field and provide a GitHub Personal Access Token."
                ) from e
        raise ValueError(f"Git clone failed: {error_msg}") from e


def _time_ago(dt: datetime) -> str:
    """Return a human-readable 'X ago' string from a datetime."""
    now = datetime.now(timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return f"{seconds} seconds ago"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    if days < 30:
        return f"{days} day{'s' if days != 1 else ''} ago"
    months = days // 30
    if months < 12:
        return f"{months} month{'s' if months != 1 else ''} ago"
    years = days // 365
    return f"{years} year{'s' if years != 1 else ''} ago"


def _extract_recent_commits(repo: git.Repo, max_count: int = 10) -> list[dict]:
    """Extract the most recent commits from the repository."""
    commits = []
    try:
        for commit in repo.iter_commits(max_count=max_count):
            author_name = commit.author.name or 'Unknown'
            # Build initials from author name (first letter of each word, max 2)
            parts = author_name.split()
            initials = ''.join(p[0].upper() for p in parts[:2]) if parts else '??'

            committed_dt = commit.committed_datetime
            time_str = _time_ago(committed_dt)

            # Get the branch name — use active branch or 'main'
            try:
                branch = repo.active_branch.name
            except Exception:
                branch = 'main'

            commits.append({
                'author': author_name,
                'email': commit.author.email or '',
                'initials': initials,
                'message': commit.message.strip().split('\n')[0],  # First line only
                'time': time_str,
                'branch': branch,
                'hash': commit.hexsha[:7],
            })
    except Exception:
        pass
    return commits


def _extract_description(repo_path: str) -> str:
    """Extract a description from the repository README if available."""
    root = Path(repo_path)
    readme_names = ['README.md', 'readme.md', 'README.rst', 'README.txt', 'README']
    for name in readme_names:
        readme_path = root / name
        if readme_path.is_file():
            try:
                content = readme_path.read_text(encoding='utf-8', errors='ignore')
                # Extract the first meaningful paragraph (skip headings/badges)
                lines = content.strip().split('\n')
                for line in lines:
                    stripped = line.strip()
                    # Skip empty lines, headings, badges, images, links
                    if not stripped:
                        continue
                    if stripped.startswith('#'):
                        continue
                    if stripped.startswith('!['):
                        continue
                    if stripped.startswith('[!['):
                        continue
                    if stripped.startswith('[!'):
                        continue
                    if stripped.startswith('<'):
                        continue
                    # Found a text line
                    desc = stripped[:500]
                    return desc
            except Exception:
                pass
    return ''


def extract_metadata(repo_path: str, repo: git.Repo) -> dict:
    """
    Scans the cloned repository directory and extracts metadata:
    - file_count
    - folder_count
    - languages (detected from file extensions)
    - last_commit_date
    - default_branch
    - branches (list)
    - recent_commits (list of dicts)
    - description (from README)
    """
    file_count = 0
    folder_count = 0
    language_counts: dict = {}

    root = Path(repo_path)

    for item in root.rglob('*'):
        # Skip hidden and blacklisted directories
        parts = item.parts
        if any(part in SKIP_DIRS for part in parts):
            continue

        if item.is_dir():
            folder_count += 1
        elif item.is_file():
            file_count += 1
            ext = item.suffix.lower()
            lang = EXTENSION_LANGUAGE_MAP.get(ext)
            if lang:
                language_counts[lang] = language_counts.get(lang, 0) + 1

    # Sort languages by file count (most common first)
    sorted_languages = sorted(language_counts.items(), key=lambda x: x[1], reverse=True)
    languages = [lang for lang, _ in sorted_languages]

    # Get the last commit date
    try:
        last_commit = repo.head.commit
        last_commit_date = last_commit.committed_datetime.isoformat()
    except Exception:
        last_commit_date = None

    # Get branches
    try:
        branches = [ref.name for ref in repo.references if isinstance(ref, git.RemoteReference)]
        branches = [b.replace('origin/', '') for b in branches if 'HEAD' not in b]
    except Exception:
        branches = []

    # Get default branch
    try:
        default_branch = repo.active_branch.name
    except Exception:
        default_branch = 'main'

    # Extract recent commits
    recent_commits = _extract_recent_commits(repo, max_count=10)

    # Extract description
    description = _extract_description(repo_path)

    return {
        'file_count': file_count,
        'folder_count': folder_count,
        'languages': languages,
        'last_commit_date': last_commit_date,
        'default_branch': default_branch,
        'branches': branches,
        'recent_commits': recent_commits,
        'description': description,
    }
