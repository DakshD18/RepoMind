"""
Path and Module Resolver for Impact Analysis.

Handles:
1. Strict path traversal prevention ensuring requested files stay inside repository boundaries.
2. Relative and absolute Python import resolution across common package root patterns.
3. JavaScript / TypeScript module resolution (extensions .ts, .tsx, .js, .jsx, and /index.*).
4. External package filtering (marking non-repository packages as external without inventing fake nodes).
"""

import os
from pathlib import Path
from typing import Optional, List, Set


class SecurityException(Exception):
    """Raised when an illegal file path or directory traversal is detected."""
    pass


def validate_safe_path(repo_dir: str | Path, target_rel_path: str) -> Path:
    """
    Validate that target_rel_path resolves strictly within repo_dir.
    Raises SecurityException if path traversal is attempted.
    Raises FileNotFoundError if file does not exist.
    Raises ValueError if target is a directory rather than a file.
    """
    if '\x00' in target_rel_path:
        raise SecurityException("Null byte detected in file path.")

    base = Path(repo_dir).resolve()
    # Normalize path string
    clean_rel = os.path.normpath(target_rel_path.strip().lstrip('/\\'))
    if clean_rel == '.' or clean_rel.startswith('..'):
        raise SecurityException("Path traversal outside repository boundary.")

    target = (base / clean_rel).resolve()

    try:
        # Python 3.9+ is_relative_to
        if not target.is_relative_to(base):
            raise SecurityException(f"Path '{target_rel_path}' escapes repository boundary.")
    except AttributeError:
        # Fallback for older python
        try:
            target.relative_to(base)
        except ValueError:
            raise SecurityException(f"Path '{target_rel_path}' escapes repository boundary.")

    if not target.exists():
        raise FileNotFoundError(f"File '{target_rel_path}' does not exist in repository.")

    if not target.is_file():
        raise ValueError(f"Path '{target_rel_path}' is a directory, not a regular file.")

    return target


def discover_python_roots(base_dir: Path) -> List[Path]:
    """
    Find likely Python sys.path roots within the repository:
    - Root directory itself
    - Subdirectories containing manage.py, pyproject.toml, setup.py, requirements.txt
    - Common convention directories like 'backend', 'src', 'app'
    """
    base_dir = Path(base_dir).resolve()
    roots: List[Path] = [base_dir]
    common_subdirs = {'backend', 'src', 'app', 'server'}

    for item in base_dir.iterdir():
        if item.is_dir() and item.name not in {'.git', 'venv', '.venv', 'node_modules', '__pycache__'}:
            if item.name.lower() in common_subdirs:
                roots.append(item.resolve())
            elif (item / 'manage.py').exists() or (item / 'setup.py').exists() or (item / '__init__.py').exists():
                roots.append(item.resolve())

    return roots


def resolve_python_import(
    module_name: str,
    importing_file_rel: str,
    base_dir: Path,
    level: int = 0,
    all_repo_files: Optional[Set[str]] = None,
) -> Optional[str]:
    """
    Resolve a Python import to a repository-relative file path.
    - level: 0 for absolute import, 1 for current package (.), 2 for parent (..), etc.
    - Returns repository-relative path (e.g. 'backend/api/models.py') or None if external.
    """
    base_dir = Path(base_dir).resolve()
    importing_file = (base_dir / importing_file_rel).resolve()
    importing_dir = importing_file.parent

    # 1. Relative import (e.g. from .models import User, from ..utils import helper)
    if level > 0:
        target_dir = importing_dir
        for _ in range(level - 1):
            target_dir = target_dir.parent

        if module_name:
            subpath = module_name.replace('.', os.sep)
            candidates = [
                target_dir / f"{subpath}.py",
                target_dir / subpath / "__init__.py",
            ]
        else:
            candidates = [
                target_dir / "__init__.py",
            ]

        for cand in candidates:
            try:
                cand_res = cand.resolve()
                if cand_res.is_file() and cand_res.is_relative_to(base_dir):
                    rel = str(cand_res.relative_to(base_dir))
                    return rel
            except Exception:
                continue
        return None

    # 2. Absolute import within the repository (e.g. import api.models or from api.models import ...)
    roots = discover_python_roots(base_dir)
    subpath = module_name.replace('.', os.sep)

    for root in roots:
        candidates = [
            root / f"{subpath}.py",
            root / subpath / "__init__.py",
        ]
        for cand in candidates:
            try:
                cand_res = cand.resolve()
                if cand_res.is_file() and cand_res.is_relative_to(base_dir):
                    rel = str(cand_res.relative_to(base_dir))
                    return rel
            except Exception:
                continue

    # Also check if the module name directly matches part of known repo files
    if all_repo_files:
        direct_cand = f"{subpath}.py"
        init_cand = f"{subpath}/__init__.py"
        for rf in all_repo_files:
            if rf.endswith(direct_cand) or rf.endswith(init_cand):
                # Verify prefix match
                if rf == direct_cand or rf.endswith('/' + direct_cand) or rf == init_cand or rf.endswith('/' + init_cand):
                    return rf

    # Not found in repository files -> External package (e.g. django, os, rest_framework)
    return None


def resolve_js_ts_import(
    import_path: str,
    importing_file_rel: str,
    base_dir: Path,
    all_repo_files: Optional[Set[str]] = None,
) -> Optional[str]:
    """
    Resolve a JS/TS import path (e.g. './components/Button', '@/services/api')
    to a repository-relative file path. Returns None for external npm packages.
    """
    base_dir = Path(base_dir).resolve()
    importing_file = (base_dir / importing_file_rel).resolve()
    importing_dir = importing_file.parent

    # Extension candidates to test in order
    extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts']

    # Case A: Relative import starting with ./ or ../
    if import_path.startswith('.'):
        target = (importing_dir / import_path).resolve()
        # Direct file check (if extension already supplied)
        try:
            if target.is_file() and target.is_relative_to(base_dir):
                return str(target.relative_to(base_dir))
        except Exception:
            pass

        # Check with extensions
        for ext in extensions:
            cand = Path(str(target) + ext)
            try:
                if cand.is_file() and cand.is_relative_to(base_dir):
                    return str(cand.relative_to(base_dir))
            except Exception:
                continue

        # Check index files (e.g. ./components/Button/index.tsx)
        for ext in extensions:
            cand = target / f"index{ext}"
            try:
                if cand.is_file() and cand.is_relative_to(base_dir):
                    return str(cand.relative_to(base_dir))
            except Exception:
                continue

        return None

    # Case B: Aliased import starting with @/ or ~/
    if import_path.startswith('@/') or import_path.startswith('~/'):
        alias_clean = import_path[2:]
        # Common alias targets: 'src', 'frontend/src', repo root
        alias_roots = [
            base_dir / 'src',
            base_dir / 'frontend' / 'src',
            base_dir,
        ]
        for root in alias_roots:
            target = root / alias_clean
            for ext in [''] + extensions:
                cand = Path(str(target) + ext) if ext else target
                try:
                    if cand.is_file() and cand.is_relative_to(base_dir):
                        return str(cand.relative_to(base_dir))
                except Exception:
                    continue
            for ext in extensions:
                cand = target / f"index{ext}"
                try:
                    if cand.is_file() and cand.is_relative_to(base_dir):
                        return str(cand.relative_to(base_dir))
                except Exception:
                    continue

    # Case C: Check if importing from a repo-local directory directly (e.g. import from 'src/App')
    for root_name in ['src', 'frontend/src', 'app']:
        if import_path.startswith(root_name + '/'):
            target = base_dir / import_path
            for ext in [''] + extensions:
                cand = Path(str(target) + ext) if ext else target
                try:
                    if cand.is_file() and cand.is_relative_to(base_dir):
                        return str(cand.relative_to(base_dir))
                except Exception:
                    continue

    # External library (e.g. 'react', '@mui/material', 'axios')
    return None
