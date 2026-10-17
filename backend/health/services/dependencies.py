"""
Dependency and Import Health Analyzer for RepoMind Phase 5.

Reuses Phase 4 dependency graph:
- Detects circular dependency cycles across the repository
- Identifies syntax errors preventing AST resolution
- Identifies unresolved internal imports
- Identifies candidate orphan / unreferenced files (excluding entry points)
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set

from impact.graph import build_dependency_graph, RepositoryDependencyGraph

logger = logging.getLogger(__name__)

# Files commonly used as standalone entry points or roots
ENTRY_POINT_FILENAMES = {
    'manage.py', 'main.py', 'app.py', 'index.ts', 'index.js',
    'app.tsx', 'app.jsx', 'wsgi.py', 'asgi.py', 'settings.py',
    'vite.config.ts', 'webpack.config.js', 'setup.py',
}


@dataclass
class DependencyHealthReport:
    total_files_in_graph: int
    circular_cycles: List[List[str]] = field(default_factory=list)
    circular_files_count: int = 0
    syntax_errors: List[dict] = field(default_factory=list)
    unresolved_imports: List[dict] = field(default_factory=list)
    candidate_orphan_files: List[str] = field(default_factory=list)


def _find_all_cycles(forward_graph: Dict[str, List[any]]) -> List[List[str]]:
    """
    Find simple directed cycles in the forward dependency graph using DFS.
    Returns list of cycles where each cycle is a list of file paths.
    """
    cycles: List[List[str]] = []
    visited: Set[str] = set()
    stack: List[str] = []
    in_stack: Set[str] = set()
    seen_cycle_keys: Set[frozenset] = set()

    # Pre-extract target files for speed
    adj: Dict[str, List[str]] = {}
    for src, edges in forward_graph.items():
        targets = []
        for e in edges:
            tgt = getattr(e, 'target_file', None) or (e.get('target_file') if isinstance(e, dict) else None)
            if tgt and tgt != src:
                targets.append(tgt)
        adj[src] = targets

    def dfs(node: str):
        visited.add(node)
        stack.append(node)
        in_stack.add(node)

        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in in_stack:
                # Cycle found!
                cycle_start_idx = stack.index(neighbor)
                cycle_path = stack[cycle_start_idx:] + [neighbor]
                cycle_set = frozenset(cycle_path)
                if cycle_set not in seen_cycle_keys and len(cycle_path) > 2:
                    seen_cycle_keys.add(cycle_set)
                    cycles.append(cycle_path)

        stack.pop()
        in_stack.remove(node)

    for file_node in list(forward_graph.keys()):
        if file_node not in visited:
            dfs(file_node)

    return cycles


def analyze_repository_dependencies(repo_id: int, repo_dir: Path) -> DependencyHealthReport:
    """
    Analyze repository import graph for cycles, syntax errors, and unresolved internal imports.
    Reuses Phase 4 graph caching.
    """
    try:
        graph = build_dependency_graph(repo_id, repo_dir)
    except Exception as e:
        logger.error("Failed to build dependency graph: %s", e)
        return DependencyHealthReport(
            total_files_in_graph=0,
            circular_cycles=[],
            circular_files_count=0,
            syntax_errors=[{'file': 'repository', 'error': str(e)}],
            unresolved_imports=[],
            candidate_orphan_files=[],
        )

    # 1. Circular cycles
    cycles = _find_all_cycles(graph.forward_graph)
    circular_files: Set[str] = set()
    for cycle in cycles:
        circular_files.update(cycle)

    # 2. Syntax errors
    syntax_errors = graph.syntax_errors or []

    # 3. Unresolved imports
    unresolved = graph.unresolved_imports or []

    # 4. Candidate orphan files (0 incoming dependents and 0 outgoing imports)
    candidate_orphans: List[str] = []
    for f in graph.all_files:
        basename = Path(f).name.lower()
        if basename in ENTRY_POINT_FILENAMES or 'test' in basename or 'migration' in f:
            continue
        in_degree = len(graph.reverse_graph.get(f, []))
        out_degree = len(graph.forward_graph.get(f, []))
        if in_degree == 0 and out_degree == 0:
            candidate_orphans.append(f)

    return DependencyHealthReport(
        total_files_in_graph=len(graph.all_files),
        circular_cycles=cycles[:10],  # Cap reported cycles
        circular_files_count=len(circular_files),
        syntax_errors=syntax_errors,
        unresolved_imports=unresolved,
        candidate_orphan_files=candidate_orphans[:20],
    )
