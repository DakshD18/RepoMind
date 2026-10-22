"""
Architecture Analysis Engine for RepoMind.

Reuses:
- Impact Analysis dependency graph (`impact.graph.build_dependency_graph`)
- Health Analyzer cycle detection (`health.services.dependencies._find_all_cycles`)
- Embeddings CodeChunk AST symbols (`embeddings.models.CodeChunk`)

Provides:
1. Architecture Overview (metrics, languages, layers, issue counts)
2. Repository Tree (hierarchical explorer of directories and files)
3. Architecture Graph (files & modules as nodes, verified dependencies as edges, bounded & filterable)
4. Component Details (incoming/outgoing dependencies, defined symbols, issues, GitHub link)
5. Architecture Findings (circular dependencies, unresolved imports)
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple

from django.conf import settings

from impact.graph import (
    build_dependency_graph,
    RepositoryDependencyGraph,
    DependencyEdge,
    DependentEdge,
)
from health.services.dependencies import _find_all_cycles
from embeddings.models import CodeChunk
from repositories.models import Repository

logger = logging.getLogger(__name__)


# ─── Language & Component Classification Helpers ─────────────────────────────

EXTENSION_LANGUAGE_MAP = {
    '.py': 'Python',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.json': 'JSON',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.html': 'HTML',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.sql': 'SQL',
    '.sh': 'Shell',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
}

ENTRY_POINT_FILENAMES = {
    'main.py', 'manage.py', 'app.py', 'index.ts', 'index.js',
    'app.tsx', 'app.jsx', 'wsgi.py', 'asgi.py', 'server.js',
    'server.ts', 'main.ts', 'main.js',
}

CONFIG_PATTERNS = {
    'vite.config.ts', 'vite.config.js', 'webpack.config.js',
    'package.json', 'tsconfig.json', 'docker-compose.yml',
    'docker-compose.yaml', 'dockerfile', 'requirements.txt',
    'settings.py', 'setup.py', '.env.example', 'pyproject.toml',
}


def get_file_language(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    return EXTENSION_LANGUAGE_MAP.get(ext, 'Code')


def format_language_name(lang: Optional[str], file_path: str = '') -> str:
    if not lang or lang == 'unknown':
        return get_file_language(file_path) if file_path else 'Code'
    l = lang.lower()
    if l == 'python':
        return 'Python'
    if l in ('javascript', 'js'):
        return 'JavaScript'
    if l in ('typescript', 'ts'):
        return 'TypeScript'
    return EXTENSION_LANGUAGE_MAP.get(Path(file_path).suffix.lower(), lang.title())


def classify_component_type(file_path: str) -> str:
    """Classify file into standard architectural component role."""
    p = Path(file_path)
    name_lower = p.name.lower()
    stem_lower = p.stem.lower()
    dir_parts = [part.lower() for part in p.parts[:-1]]

    if name_lower in ENTRY_POINT_FILENAMES:
        return 'entry_point'

    if name_lower in CONFIG_PATTERNS or name_lower.endswith('.config.ts') or name_lower.endswith('.config.js'):
        return 'config'

    if any(d in ('tests', 'test', '__tests__') for d in dir_parts) or '.test.' in name_lower or '.spec.' in name_lower or name_lower.startswith('test_') or stem_lower.startswith('test_'):
        return 'test'

    if stem_lower in ('views', 'routes', 'urls', 'controller', 'controllers', 'router', 'endpoints') or any(d in ('routes', 'views', 'controllers', 'endpoints') for d in dir_parts) or stem_lower.endswith('_view') or stem_lower.endswith('_route'):
        return 'route'

    if stem_lower in ('models', 'model', 'schema', 'schemas', 'entity', 'entities') or any(d in ('models', 'schemas', 'entities') for d in dir_parts) or stem_lower.endswith('_model') or stem_lower.endswith('_schema'):
        return 'model'

    if stem_lower in ('service', 'services', 'analyzer', 'analyzers', 'utils', 'helpers', 'scanner') or any(d in ('services', 'analyzers', 'utils', 'helpers') for d in dir_parts) or stem_lower.endswith('_service'):
        return 'service'

    if any(d in ('components', 'pages', 'layouts') for d in dir_parts) or p.suffix.lower() in ('.tsx', '.jsx') or stem_lower.endswith('component') or stem_lower.endswith('page') or stem_lower.endswith('widget'):
        return 'component'

    return 'file'


# ─── 1. Architecture Overview ────────────────────────────────────────────────

def get_architecture_overview(repo: Repository, repo_dir: Path) -> Dict[str, Any]:
    """Calculate high-level architecture overview metrics."""
    graph = build_dependency_graph(repo.id, repo_dir)
    cycles = _find_all_cycles(graph.forward_graph)

    # Calculate circular files set
    circular_files: Set[str] = set()
    for cycle in cycles:
        circular_files.update(cycle)

    # Language distribution
    languages: Dict[str, int] = {}
    component_types: Dict[str, int] = {}
    directories: Set[str] = set()

    for file_path in graph.all_files:
        lang = get_file_language(file_path)
        languages[lang] = languages.get(lang, 0) + 1

        ctype = classify_component_type(file_path)
        component_types[ctype] = component_types.get(ctype, 0) + 1

        parent = str(Path(file_path).parent)
        if parent != '.':
            directories.add(parent)

    total_edges = sum(len(edges) for edges in graph.forward_graph.values())

    return {
        'repo_id': repo.id,
        'repo_name': repo.name,
        'default_branch': repo.default_branch or 'main',
        'revision': graph.revision,
        'total_files': len(graph.all_files),
        'total_directories': len(directories),
        'total_dependencies': total_edges,
        'languages': languages,
        'component_types': component_types,
        'circular_cycles_count': len(cycles),
        'circular_files_count': len(circular_files),
        'unresolved_imports_count': len(graph.unresolved_imports),
        'syntax_errors_count': len(graph.syntax_errors),
    }


# ─── 2. Repository Tree ──────────────────────────────────────────────────────

def build_architecture_tree(
    repo_dir: Path,
    graph: RepositoryDependencyGraph,
    search_query: str = '',
) -> List[Dict[str, Any]]:
    """
    Build nested file and folder tree structure with architecture badges.
    """
    cycles = _find_all_cycles(graph.forward_graph)
    circular_files = {f for cycle in cycles for f in cycle}
    unresolved_files = {u.get('file') for u in graph.unresolved_imports if u.get('file')}

    # Pre-build lookup for root and nested directories
    root_nodes: Dict[str, Any] = {}

    def get_or_create_dir(path_parts: Tuple[str, ...], container: Dict[str, Any]) -> Dict[str, Any]:
        current_path = ''
        curr_dict = container
        for part in path_parts:
            current_path = f"{current_path}/{part}" if current_path else part
            if part not in curr_dict:
                curr_dict[part] = {
                    'id': f"dir:{current_path}",
                    'name': part,
                    'path': current_path,
                    'type': 'directory',
                    'file_count': 0,
                    'children': {},
                }
            curr_dict = curr_dict[part]['children']
        return curr_dict

    filtered_files = graph.all_files
    if search_query:
        q = search_query.strip().lower()
        filtered_files = [f for f in graph.all_files if q in f.lower()]

    for file_path in filtered_files:
        meta = graph.file_metadata.get(file_path)
        p = Path(file_path)
        parts = p.parts

        parent_parts = parts[:-1]
        filename = parts[-1]

        target_children = get_or_create_dir(parent_parts, root_nodes)

        in_count = len(graph.reverse_graph.get(file_path, []))
        out_count = len(graph.forward_graph.get(file_path, []))

        target_children[filename] = {
            'id': file_path,
            'name': filename,
            'path': file_path,
            'type': 'file',
            'component_type': classify_component_type(file_path),
            'language': format_language_name(meta.language if meta else None, file_path),
            'line_count': meta.line_count if meta else 0,
            'direct_dependencies_count': out_count,
            'direct_dependents_count': in_count,
            'is_circular': file_path in circular_files,
            'has_unresolved': file_path in unresolved_files,
        }

    # Recursive converter from dict tree to sorted list tree
    def format_tree(container: Dict[str, Any]) -> List[Dict[str, Any]]:
        result = []
        for name, item in container.items():
            if item['type'] == 'directory':
                children_list = format_tree(item['children'])
                # Sum file counts of all descendants
                file_count = sum(
                    child['file_count'] if child['type'] == 'directory' else 1
                    for child in children_list
                )
                result.append({
                    'id': item['id'],
                    'name': item['name'],
                    'path': item['path'],
                    'type': 'directory',
                    'file_count': file_count,
                    'children': children_list,
                })
            else:
                result.append(item)

        # Sort directories first, then files alphabetically
        return sorted(result, key=lambda x: (0 if x['type'] == 'directory' else 1, x['name'].lower()))

    return format_tree(root_nodes)


# ─── 3. Architecture Graph ───────────────────────────────────────────────────

def extract_architecture_graph(
    repo: Repository,
    repo_dir: Path,
    module_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    component_type_filter: Optional[str] = None,
    relationship_type_filter: Optional[str] = None,
    focus_file: Optional[str] = None,
    limit: int = 80,
) -> Dict[str, Any]:
    """
    Extract bounded, filterable nodes and edges for the interactive dependency graph.
    """
    graph = build_dependency_graph(repo.id, repo_dir)
    cycles = _find_all_cycles(graph.forward_graph)

    circular_files = {f for cycle in cycles for f in cycle}
    circular_edges: Set[Tuple[str, str]] = set()
    for cycle in cycles:
        for i in range(len(cycle) - 1):
            circular_edges.add((cycle[i], cycle[i + 1]))

    unresolved_files = {u.get('file') for u in graph.unresolved_imports if u.get('file')}

    # Base candidate files
    candidates = list(graph.all_files)

    if module_filter:
        mod_prefix = module_filter.strip('/')
        candidates = [f for f in candidates if f == mod_prefix or f.startswith(f"{mod_prefix}/")]

    if search_query:
        sq = search_query.strip().lower()
        candidates = [f for f in candidates if sq in f.lower()]

    if component_type_filter:
        candidates = [f for f in candidates if classify_component_type(f) == component_type_filter]

    # Focus node expansion (if focus_file provided)
    if focus_file and focus_file in graph.all_files:
        focused_set = {focus_file}
        # Add 1-hop outgoing
        for edge in graph.forward_graph.get(focus_file, []):
            focused_set.add(edge.target_file)
        # Add 1-hop incoming
        for dep in graph.reverse_graph.get(focus_file, []):
            focused_set.add(dep.dependent_file)
        candidates = [f for f in candidates if f in focused_set]

    # Calculate degrees for sorting / ranking
    node_degrees: Dict[str, int] = {}
    for f in candidates:
        in_deg = len(graph.reverse_graph.get(f, []))
        out_deg = len(graph.forward_graph.get(f, []))
        # Boost nodes that are circular or focused
        boost = 100 if f == focus_file else (20 if f in circular_files else 0)
        node_degrees[f] = in_deg + out_deg + boost

    # Rank and bound nodes
    bounded_candidates = sorted(candidates, key=lambda f: node_degrees[f], reverse=True)
    total_matching_nodes = len(bounded_candidates)

    if limit > 0 and len(bounded_candidates) > limit:
        selected_files_set = set(bounded_candidates[:limit])
        is_truncated = True
    else:
        selected_files_set = set(bounded_candidates)
        is_truncated = False

    # Build nodes list
    nodes = []
    for f in bounded_candidates:
        if f not in selected_files_set:
            continue
        meta = graph.file_metadata.get(f)
        parent_dir = str(Path(f).parent)
        module_name = parent_dir if parent_dir != '.' else 'root'

        in_deg = len(graph.reverse_graph.get(f, []))
        out_deg = len(graph.forward_graph.get(f, []))

        nodes.append({
            'id': f,
            'name': Path(f).name,
            'path': f,
            'type': 'file',
            'component_type': classify_component_type(f),
            'language': format_language_name(meta.language if meta else None, f),
            'line_count': meta.line_count if meta else 0,
            'in_degree': in_deg,
            'out_degree': out_deg,
            'total_degree': in_deg + out_deg,
            'module': module_name,
            'is_circular': f in circular_files,
            'has_unresolved': f in unresolved_files,
        })

    # Build edges between selected nodes
    edges = []
    total_edges_count = 0
    for src in selected_files_set:
        for fwd_edge in graph.forward_graph.get(src, []):
            total_edges_count += 1
            tgt = fwd_edge.target_file
            if tgt not in selected_files_set:
                continue

            if relationship_type_filter and fwd_edge.relationship_type != relationship_type_filter:
                continue

            is_cycle_edge = (src, tgt) in circular_edges

            edges.append({
                'id': f"{src}->{tgt}",
                'source': src,
                'target': tgt,
                'relationship_type': fwd_edge.relationship_type,
                'imported_symbols': fwd_edge.imported_symbols,
                'line_number': fwd_edge.line_number,
                'is_circular': is_cycle_edge,
            })

    return {
        'repo_id': repo.id,
        'revision': graph.revision,
        'nodes': nodes,
        'edges': edges,
        'total_nodes_in_repo': len(graph.all_files),
        'nodes_returned': len(nodes),
        'total_matching_nodes': total_matching_nodes,
        'total_edges_in_graph': total_edges_count,
        'edges_returned': len(edges),
        'is_truncated': is_truncated,
    }


# ─── 4. Component Details ────────────────────────────────────────────────────

def extract_node_detail(
    repo: Repository,
    repo_dir: Path,
    file_path: str,
) -> Optional[Dict[str, Any]]:
    """
    Get detailed incoming/outgoing relationships, symbols, issues, and metadata for a node.
    """
    graph = build_dependency_graph(repo.id, repo_dir)
    if file_path not in graph.all_files:
        return None

    meta = graph.file_metadata.get(file_path)
    cycles = _find_all_cycles(graph.forward_graph)

    # Cycles touching this file
    related_cycles = [c for c in cycles if file_path in c]
    is_circular = len(related_cycles) > 0

    # Unresolved imports in this file
    unresolved_in_file = [
        u for u in graph.unresolved_imports if u.get('file') == file_path
    ]

    # Syntax errors in this file
    syntax_errors_in_file = [
        s for s in graph.syntax_errors if s.get('file_path') == file_path
    ]

    # Outgoing dependencies (files this file imports)
    outgoing_deps = []
    for edge in graph.forward_graph.get(file_path, []):
        target_meta = graph.file_metadata.get(edge.target_file)
        outgoing_deps.append({
            'file_path': edge.target_file,
            'relationship_type': edge.relationship_type,
            'imported_symbols': edge.imported_symbols,
            'line_number': edge.line_number,
            'language': format_language_name(target_meta.language if target_meta else None, edge.target_file),
            'is_circular': any(
                edge.target_file in c and file_path in c for c in related_cycles
            ),
        })

    # Incoming dependencies (files that import this file)
    incoming_deps = []
    for dep in graph.reverse_graph.get(file_path, []):
        dep_meta = graph.file_metadata.get(dep.dependent_file)
        incoming_deps.append({
            'file_path': dep.dependent_file,
            'relationship_type': dep.relationship_type,
            'imported_symbols': dep.imported_symbols,
            'line_number': dep.line_number,
            'language': format_language_name(dep_meta.language if dep_meta else None, dep.dependent_file),
            'is_circular': any(
                dep.dependent_file in c and file_path in c for c in related_cycles
            ),
        })

    # Defined symbols from AST / CodeChunk
    defined_symbols_list: List[Dict[str, Any]] = []
    chunks = CodeChunk.objects.filter(repository=repo, file_path=file_path)
    if chunks.exists():
        for chunk in chunks:
            if chunk.symbol_name:
                defined_symbols_list.append({
                    'name': chunk.symbol_name,
                    'type': chunk.symbol_type,
                    'class_name': chunk.class_name,
                    'start_line': chunk.start_line,
                    'end_line': chunk.end_line,
                })
    elif meta and meta.defined_symbols:
        for sym in meta.defined_symbols:
            defined_symbols_list.append({
                'name': sym,
                'type': 'symbol',
                'class_name': '',
                'start_line': None,
                'end_line': None,
            })

    # Construct safe GitHub URL
    github_url = ''
    if repo.url:
        clean_url = repo.url.rstrip('/')
        branch = repo.default_branch or 'main'
        github_url = f"{clean_url}/blob/{branch}/{file_path}"

    parent_dir = str(Path(file_path).parent)
    module_name = parent_dir if parent_dir != '.' else 'root'

    return {
        'file_path': file_path,
        'name': Path(file_path).name,
        'module': module_name,
        'language': format_language_name(meta.language if meta else None, file_path),
        'component_type': classify_component_type(file_path),
        'line_count': meta.line_count if meta else 0,
        'github_url': github_url,
        'incoming_dependencies': incoming_deps,
        'incoming_count': len(incoming_deps),
        'outgoing_dependencies': outgoing_deps,
        'outgoing_count': len(outgoing_deps),
        'defined_symbols': defined_symbols_list,
        'is_circular': is_circular,
        'cycles': related_cycles,
        'unresolved_imports': unresolved_in_file,
        'syntax_errors': syntax_errors_in_file,
    }


# ─── 5. Architecture Findings ────────────────────────────────────────────────

def detect_architecture_findings(repo: Repository, repo_dir: Path) -> Dict[str, Any]:
    """
    Detect structural architecture issues: circular dependencies and unresolved imports.
    """
    graph = build_dependency_graph(repo.id, repo_dir)
    raw_cycles = _find_all_cycles(graph.forward_graph)

    # Format circular dependencies
    circular_findings = []
    affected_circular_files: Set[str] = set()

    for idx, cycle in enumerate(raw_cycles, start=1):
        affected_circular_files.update(cycle)
        cycle_chain = " → ".join(cycle)
        circular_findings.append({
            'id': f"circ-{idx}",
            'type': 'circular_dependency',
            'severity': 'HIGH',
            'title': f"Circular Dependency ({len(cycle) - 1} files)",
            'cycle': cycle,
            'length': len(cycle) - 1,
            'description': f"A circular dependency loop was detected: {cycle_chain}",
            'affected_files': cycle,
            'recommendation': "Decouple shared abstractions, extract common models/types into a dedicated layer, or use dependency inversion.",
        })

    # Format unresolved imports
    unresolved_findings = []
    for idx, item in enumerate(graph.unresolved_imports, start=1):
        unresolved_findings.append({
            'id': f"unres-{idx}",
            'type': 'unresolved_import',
            'severity': 'MEDIUM',
            'title': f"Unresolved Import: {item.get('module')}",
            'file_path': item.get('file'),
            'module': item.get('module'),
            'line_number': item.get('line'),
            'description': f"File '{item.get('file')}' attempts to import module '{item.get('module')}' on line {item.get('line')}, but it cannot be resolved locally.",
            'recommendation': "Verify if this is an external third-party package or if the local relative/alias import path is incorrect.",
        })

    return {
        'repo_id': repo.id,
        'revision': graph.revision,
        'total_findings': len(circular_findings) + len(unresolved_findings),
        'circular_dependencies': circular_findings,
        'circular_count': len(circular_findings),
        'circular_files_count': len(affected_circular_files),
        'unresolved_imports': unresolved_findings,
        'unresolved_count': len(unresolved_findings),
        'syntax_errors': graph.syntax_errors,
    }
