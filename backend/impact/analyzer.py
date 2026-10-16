"""
Impact Analyzer and Risk Calculation Engine.

Traverses the reverse dependency graph to identify:
1. Direct dependents (depth 1)
2. Transitive dependents (depth > 1) with complete dependency chains
3. Circular dependencies along the path

Calculates an explainable, deterministic risk score (0-100) and risk level (LOW, MEDIUM, HIGH)
based on transparent graph metrics:
- Direct and transitive dependent counts
- Blast radius ratio (affected files / total repository files)
- Maximum dependency depth
- In-degree centrality (fan-in)
- Circular coupling
"""

from collections import deque
from typing import Dict, List, Set, Any
from .graph import RepositoryDependencyGraph, DependentEdge, FileMeta


def analyze_file_impact(graph: RepositoryDependencyGraph, target_file: str, max_depth: int = 6) -> dict:
    """
    Perform impact analysis on target_file by traversing the reverse graph.
    Returns complete impact report including direct and transitive dependents,
    dependency paths, tree structure, explainable risk score, and limitations.
    """
    total_repo_files = len(graph.all_files) or 1
    target_meta = graph.file_metadata.get(target_file)

    # 1. Reverse graph traversal (BFS)
    # Queue items: (current_file, depth, path_so_far)
    queue = deque([(target_file, 0, [target_file])])
    visited: Dict[str, int] = {target_file: 0}

    direct_dependents: List[dict] = []
    transitive_dependents: List[dict] = []
    dependency_paths: List[List[str]] = []
    cycles_detected: List[List[str]] = []
    affected_files_set: Set[str] = set()

    # Direct edges for immediate dependents
    direct_edges_map: Dict[str, List[DependentEdge]] = {}
    for edge in graph.reverse_graph.get(target_file, []):
        direct_edges_map.setdefault(edge.dependent_file, []).append(edge)

    while queue:
        curr_file, depth, path = queue.popleft()

        if depth >= max_depth:
            continue

        reverse_edges = graph.reverse_graph.get(curr_file, [])
        for edge in reverse_edges:
            next_file = edge.dependent_file

            # Cycle detection: next_file already in current path
            if next_file in path:
                cycle = path[path.index(next_file):] + [next_file]
                if cycle not in cycles_detected:
                    cycles_detected.append(cycle)
                continue

            new_depth = depth + 1
            new_path = path + [next_file]

            if next_file not in visited or new_depth < visited[next_file]:
                visited[next_file] = new_depth
                affected_files_set.add(next_file)
                dependency_paths.append(new_path)

                if new_depth == 1:
                    direct_dependents.append({
                        'file_path': next_file,
                        'relationship_type': edge.relationship_type,
                        'imported_symbols': edge.imported_symbols,
                        'line_number': edge.line_number,
                    })
                else:
                    transitive_dependents.append({
                        'file_path': next_file,
                        'depth': new_depth,
                        'via': path[-1],
                        'dependency_path': new_path,
                    })

                queue.append((next_file, new_depth, new_path))

    # 2. Build structured dependency tree for UI
    def build_tree(node_file: str, current_depth: int, current_chain: Set[str]) -> dict:
        node_tree = {
            'file_path': node_file,
            'depth': current_depth,
            'children': [],
        }
        if current_depth >= max_depth or node_file in current_chain:
            return node_tree

        new_chain = current_chain | {node_file}
        for edge in graph.reverse_graph.get(node_file, []):
            dep = edge.dependent_file
            if dep not in current_chain:
                child_tree = build_tree(dep, current_depth + 1, new_chain)
                child_tree['relationship_type'] = edge.relationship_type
                child_tree['imported_symbols'] = edge.imported_symbols
                node_tree['children'].append(child_tree)

        return node_tree

    dependency_tree = build_tree(target_file, 0, set())

    # 3. Calculate Explainable Risk Assessment
    direct_count = len(direct_dependents)
    transitive_count = len(transitive_dependents)
    total_affected = len(affected_files_set)
    max_observed_depth = max([visited[f] for f in affected_files_set], default=0)
    blast_radius_ratio = total_affected / total_repo_files

    score = 0
    reasons: List[str] = []
    factors: Dict[str, Any] = {
        'direct_dependent_count': direct_count,
        'transitive_dependent_count': transitive_count,
        'total_affected_files': total_affected,
        'max_dependency_depth': max_observed_depth,
        'blast_radius_ratio': round(blast_radius_ratio, 3),
        'in_degree_centrality': direct_count,
        'cycles_detected_count': len(cycles_detected),
    }

    # Factor A: Direct dependents
    direct_pts = min(direct_count * 10, 30)
    score += direct_pts
    if direct_count > 0:
        reasons.append(f"Directly imported by {direct_count} file{'s' if direct_count != 1 else ''} (+{direct_pts} pts)")
    else:
        reasons.append("No files directly import this file (leaf module)")

    # Factor B: Transitive dependents
    transitive_pts = min(transitive_count * 5, 25)
    score += transitive_pts
    if transitive_count > 0:
        reasons.append(f"Transitively reaches {transitive_count} downstream module{'s' if transitive_count != 1 else ''} (+{transitive_pts} pts)")

    # Factor C: Dependency depth
    if max_observed_depth >= 3:
        score += 20
        reasons.append(f"Deep dependency chain of {max_observed_depth} hops increases cascading failure risk (+20 pts)")
    elif max_observed_depth == 2:
        score += 10
        reasons.append("Two-tier dependency chain (+10 pts)")

    # Factor D: Centrality / Blast radius ratio
    if blast_radius_ratio >= 0.25:
        score += 20
        reasons.append(f"High repository centrality: affects {round(blast_radius_ratio * 100)}% of the entire codebase (+20 pts)")
    elif blast_radius_ratio >= 0.10:
        score += 10
        reasons.append(f"Moderate repository impact: affects {round(blast_radius_ratio * 100)}% of codebase (+10 pts)")

    # Factor E: High in-degree centrality
    if direct_count >= 5:
        score += 15
        reasons.append(f"Hub module with high in-degree fan-in ({direct_count} incoming imports) (+15 pts)")

    # Factor F: Circular dependencies
    if cycles_detected:
        score += 10
        reasons.append(f"Part of {len(cycles_detected)} circular dependency loop{'s' if len(cycles_detected) != 1 else ''} (+10 pts)")

    score = max(5, min(100, score))

    if score >= 70:
        risk_level = 'HIGH'
    elif score >= 40:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    # 4. Limitations & Edge Cases
    limitations: List[str] = [
        "Analysis is static: dynamic reflection (e.g. getattr, importlib) is not executed.",
        "External library imports (e.g. standard library, 3rd party packages) are excluded from the repository impact graph.",
    ]
    if graph.syntax_errors:
        limitations.append(f"{len(graph.syntax_errors)} file(s) with syntax errors could not be parsed.")

    return {
        'target_file': target_file,
        'repository_id': graph.repo_id,
        'revision': graph.revision,
        'target_metadata': {
            'language': target_meta.language if target_meta else 'unknown',
            'line_count': target_meta.line_count if target_meta else 0,
            'defined_symbols': target_meta.defined_symbols if target_meta else [],
        },
        'summary': {
            'total_affected_files': total_affected,
            'direct_dependent_count': direct_count,
            'transitive_dependent_count': transitive_count,
            'max_depth': max_observed_depth,
            'total_repository_files': total_repo_files,
        },
        'risk_assessment': {
            'level': risk_level,
            'score': score,
            'reasons': reasons,
            'factors': factors,
            'is_estimate': True,
            'disclaimer': "Risk scores are explainable heuristic estimates based on static graph metrics, not guaranteed runtime failure predictions.",
        },
        'direct_dependents': sorted(direct_dependents, key=lambda x: x['file_path']),
        'transitive_dependents': sorted(transitive_dependents, key=lambda x: (x['depth'], x['file_path'])),
        'dependency_paths': dependency_paths,
        'cycles_detected': cycles_detected,
        'dependency_tree': dependency_tree,
        'limitations': limitations,
    }
