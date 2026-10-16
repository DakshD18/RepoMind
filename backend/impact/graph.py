"""
Dependency Graph Builder & Cache Manager for Impact Analysis.

Explicit Graph Direction:
- Forward Edge (A -> B): File A imports / depends on File B.
- Reverse Edge (B -> A): File A is a dependent of File B.
  (If File B changes, we traverse reverse edges to find A and its downstream dependents).

Cache Invalidation:
- Keys cache by Git HEAD commit revision (or content hash fingerprint if Git is unavailable).
- Automatically invalidates and rebuilds when repository is synced or re-analysed.
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Set, Optional, Tuple

import git

from .parser import parse_source_file, FileParseResult
from .resolver import resolve_python_import, resolve_js_ts_import

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx'}

SKIP_DIRS = {
    '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env',
    'dist', 'build', '.next', '.cache', 'vendor', '.mypy_cache',
    '.pytest_cache', 'coverage', 'site-packages', 'migrations',
}


@dataclass
class DependencyEdge:
    source_file: str            # File importing
    target_file: str            # File being imported
    relationship_type: str      # 'imports_module' | 'imports_symbol' | 'calls_function' | 'inherits_class'
    imported_symbols: List[str]
    line_number: int


@dataclass
class DependentEdge:
    dependent_file: str         # File that depends on this file
    relationship_type: str
    imported_symbols: List[str]
    line_number: int


@dataclass
class FileMeta:
    file_path: str
    language: str
    line_count: int
    defined_symbols: List[str]


class RepositoryDependencyGraph:
    def __init__(self, repo_id: int, repo_dir: Path, revision: str):
        self.repo_id = repo_id
        self.repo_dir = repo_dir
        self.revision = revision
        self.all_files: List[str] = []
        # forward_graph[A] = list of files that A depends on (A imports B)
        self.forward_graph: Dict[str, List[DependencyEdge]] = {}
        # reverse_graph[B] = list of files that depend on B (B is imported by A)
        self.reverse_graph: Dict[str, List[DependentEdge]] = {}
        self.file_metadata: Dict[str, FileMeta] = {}
        self.unresolved_imports: List[dict] = []
        self.syntax_errors: List[dict] = []

    def to_dict(self) -> dict:
        return {
            'repo_id': self.repo_id,
            'revision': self.revision,
            'all_files': self.all_files,
            'forward_graph': {
                k: [asdict(e) for e in edges] for k, edges in self.forward_graph.items()
            },
            'reverse_graph': {
                k: [asdict(e) for e in edges] for k, edges in self.reverse_graph.items()
            },
            'file_metadata': {
                k: asdict(meta) for k, meta in self.file_metadata.items()
            },
            'unresolved_imports': self.unresolved_imports,
            'syntax_errors': self.syntax_errors,
        }

    @classmethod
    def from_dict(cls, data: dict, repo_dir: Path) -> 'RepositoryDependencyGraph':
        graph = cls(repo_id=data['repo_id'], repo_dir=repo_dir, revision=data['revision'])
        graph.all_files = data.get('all_files', [])
        graph.forward_graph = {
            k: [DependencyEdge(**e) for e in edges]
            for k, edges in data.get('forward_graph', {}).items()
        }
        graph.reverse_graph = {
            k: [DependentEdge(**e) for e in edges]
            for k, edges in data.get('reverse_graph', {}).items()
        }
        graph.file_metadata = {
            k: FileMeta(**m) for k, m in data.get('file_metadata', {}).items()
        }
        graph.unresolved_imports = data.get('unresolved_imports', [])
        graph.syntax_errors = data.get('syntax_errors', [])
        return graph


def get_repository_revision(repo_dir: Path) -> str:
    """Get the current Git commit hash or fallback content fingerprint."""
    try:
        git_repo = git.Repo(repo_dir)
        return git_repo.head.commit.hexsha
    except Exception:
        # Fallback to content mtime + size hash of supported files
        hasher = hashlib.sha256()
        try:
            for root, dirs, files in os.walk(repo_dir):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for f in sorted(files):
                    if Path(f).suffix.lower() in SUPPORTED_EXTENSIONS:
                        fp = Path(root) / f
                        st = fp.stat()
                        hasher.update(f"{fp.relative_to(repo_dir)}:{st.st_size}:{st.st_mtime}".encode())
            return hasher.hexdigest()[:40]
        except Exception:
            return "unknown_revision"


def _scan_repository_files(repo_dir: Path) -> List[Tuple[str, Path]]:
    """Scan repo directory for all supported source code files."""
    repo_dir = Path(repo_dir).resolve()
    files_to_process = []
    for root, dirs, files in os.walk(repo_dir):
        # Exclude skip directories in place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            ext = Path(f).suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = (Path(root) / f).resolve()
                try:
                    rel_path = str(full_path.relative_to(repo_dir))
                    files_to_process.append((rel_path, full_path))
                except Exception:
                    continue
    return sorted(files_to_process, key=lambda x: x[0])


def build_dependency_graph(repo_id: int, repo_dir: Path, force_rebuild: bool = False) -> RepositoryDependencyGraph:
    """
    Build or load from cache the dependency graph for a repository.
    Validates cache against current Git revision or file fingerprint.
    """
    repo_dir = Path(repo_dir).resolve()
    current_revision = get_repository_revision(repo_dir)
    cache_path = repo_dir / '.repomind_impact_cache.json'

    # Check cache validity
    if not force_rebuild and cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('revision') == current_revision and data.get('repo_id') == repo_id:
                logger.debug("Loaded dependency graph from cache for repo %s (rev %s)", repo_id, current_revision)
                return RepositoryDependencyGraph.from_dict(data, repo_dir)
            else:
                logger.info("Cache invalid: rev mismatch (cached: %s, current: %s)", data.get('revision'), current_revision)
        except Exception as e:
            logger.warning("Failed reading impact graph cache: %s", e)

    # Rebuild graph
    graph = RepositoryDependencyGraph(repo_id=repo_id, repo_dir=repo_dir, revision=current_revision)
    scanned_files = _scan_repository_files(repo_dir)
    all_rel_paths = {rel for rel, _ in scanned_files}
    graph.all_files = sorted(list(all_rel_paths))

    parsed_map: Dict[str, FileParseResult] = {}

    # Step 1: Parse all files
    for rel_path, full_path in scanned_files:
        parse_res = parse_source_file(rel_path, full_path)
        if parse_res is None:
            continue

        if not parse_res.syntax_valid:
            graph.syntax_errors.append({
                'file_path': rel_path,
                'error': parse_res.error_message,
            })

        parsed_map[rel_path] = parse_res

        # Store metadata
        try:
            with open(full_path, 'r', encoding='utf-8', errors='replace') as sf:
                line_count = sum(1 for _ in sf)
        except Exception:
            line_count = 0

        graph.file_metadata[rel_path] = FileMeta(
            file_path=rel_path,
            language=parse_res.language,
            line_count=line_count,
            defined_symbols=parse_res.defined_symbols,
        )

        graph.forward_graph[rel_path] = []
        graph.reverse_graph[rel_path] = []

    # Step 2: Resolve imports and wire forward & reverse edges
    for source_rel, parse_res in parsed_map.items():
        for raw_imp in parse_res.raw_imports:
            target_rel = None

            if parse_res.language == 'python':
                target_rel = resolve_python_import(
                    module_name=raw_imp.source_module,
                    importing_file_rel=source_rel,
                    base_dir=repo_dir,
                    level=raw_imp.level,
                    all_repo_files=all_rel_paths,
                )
            elif parse_res.language in ('javascript', 'typescript'):
                target_rel = resolve_js_ts_import(
                    import_path=raw_imp.source_module,
                    importing_file_rel=source_rel,
                    base_dir=repo_dir,
                    all_repo_files=all_rel_paths,
                )

            if target_rel and target_rel in all_rel_paths:
                # Do not self-loop on file-level import
                if target_rel == source_rel:
                    continue

                # Classify relationship type
                rel_type = 'imports_module'
                if raw_imp.imported_names and raw_imp.imported_names != ['*']:
                    # Check if imported symbols are actively called/referenced
                    used_symbols = [s for s in raw_imp.imported_names if s in parse_res.referenced_symbols]
                    if used_symbols:
                        rel_type = 'calls_function' if any(s[0].islower() for s in used_symbols) else 'imports_symbol'
                    else:
                        rel_type = 'imports_symbol'

                fwd_edge = DependencyEdge(
                    source_file=source_rel,
                    target_file=target_rel,
                    relationship_type=rel_type,
                    imported_symbols=raw_imp.imported_names,
                    line_number=raw_imp.line_number,
                )
                graph.forward_graph.setdefault(source_rel, []).append(fwd_edge)

                rev_edge = DependentEdge(
                    dependent_file=source_rel,
                    relationship_type=rel_type,
                    imported_symbols=raw_imp.imported_names,
                    line_number=raw_imp.line_number,
                )
                graph.reverse_graph.setdefault(target_rel, []).append(rev_edge)

            else:
                # External package or unresolved import
                graph.unresolved_imports.append({
                    'file': source_rel,
                    'module': raw_imp.source_module,
                    'line': raw_imp.line_number,
                })

    # Save to cache
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(graph.to_dict(), f, indent=2)
        logger.debug("Saved dependency graph cache to %s", cache_path)
    except Exception as e:
        logger.warning("Could not write impact graph cache: %s", e)

    return graph
