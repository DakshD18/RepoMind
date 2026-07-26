"""
Parser Services — Core logic for cloning repositories and extracting metadata.
"""

import os
import shutil
from pathlib import Path
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


def clone_repository(repo_url: str, target_dir: str) -> git.Repo:
    """
    Clones a public GitHub repository to the given target directory.
    Uses a shallow clone (depth=1) for performance.
    Removes the existing directory first if it already exists.
    """
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)

    repo = git.Repo.clone_from(repo_url, target_dir, depth=1)
    return repo


def extract_metadata(repo_path: str, repo: git.Repo) -> dict:
    """
    Scans the cloned repository directory and extracts metadata:
    - file_count
    - folder_count
    - languages (detected from file extensions)
    - last_commit_date
    - default_branch
    - branches (list)
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

    return {
        'file_count': file_count,
        'folder_count': folder_count,
        'languages': languages,
        'last_commit_date': last_commit_date,
        'default_branch': default_branch,
        'branches': branches,
    }
