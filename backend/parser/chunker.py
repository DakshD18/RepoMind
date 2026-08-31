"""
AST-Aware Code Chunker (Phase 2).

Extracts meaningful code chunks from a repository directory:
- For Python, JS, TS/TSX: uses Tree-sitter AST to extract functions, classes, and methods
  with exact symbol names and line boundaries.
- For all other text files: falls back to sliding-window block chunking.

Each chunk is a dict:
    {
        'file_path': str,          # relative to repo root
        'symbol_name': str,        # function/class/method name or ''
        'symbol_type': str,        # 'function' | 'class' | 'method' | 'module' | 'block'
        'start_line': int,         # 1-indexed
        'end_line': int,           # 1-indexed inclusive
        'content': str,            # actual source code
    }
"""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── File filtering ────────────────────────────────────────────────────────────

SKIP_DIRS = {
    '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env',
    'dist', 'build', '.next', '.cache', 'vendor', '.mypy_cache',
    '.pytest_cache', 'coverage', '.tox', 'target',
}

SKIP_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp4', '.mp3', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.bz2', '.7z',
    '.woff', '.woff2', '.ttf', '.eot',
    '.pdf', '.docx', '.xlsx',
    '.pyc', '.pyo', '.class',
    '.min.js', '.min.css',  # handled below for compound ext
}

MAX_FILE_SIZE_BYTES = 200_000   # 200 KB — skip likely minified / huge files
MAX_CHUNK_CONTENT = 4000        # chars cap per chunk to keep context manageable
BLOCK_CHUNK_LINES = 40          # lines per block chunk for non-AST files
BLOCK_OVERLAP_LINES = 5         # overlap between blocks


# ─── Tree-sitter setup ─────────────────────────────────────────────────────────

def _load_ts_parsers():
    """Lazily load Tree-sitter parsers; return dict or empty dict on failure."""
    try:
        import tree_sitter_python as tspython
        import tree_sitter_javascript as tsjavascript
        import tree_sitter_typescript as tstypescript
        from tree_sitter import Language, Parser

        parsers = {
            '.py': Parser(Language(tspython.language())),
            '.js': Parser(Language(tsjavascript.language())),
            '.jsx': Parser(Language(tsjavascript.language())),
            '.ts': Parser(Language(tstypescript.language_typescript())),
            '.tsx': Parser(Language(tstypescript.language_tsx())),
        }
        logger.debug('Tree-sitter parsers loaded.')
        return parsers
    except Exception as exc:
        logger.warning('Tree-sitter unavailable; falling back to block chunking. %s', exc)
        return {}


_TS_PARSERS: dict | None = None


def _get_parsers() -> dict:
    global _TS_PARSERS
    if _TS_PARSERS is None:
        _TS_PARSERS = _load_ts_parsers()
    return _TS_PARSERS


# ─── AST-based chunking ────────────────────────────────────────────────────────

# Node types that represent top-level symbols to extract
_SYMBOL_NODE_TYPES = {
    # Python
    'function_definition': ('function', 'name'),
    'class_definition': ('class', 'name'),
    'decorated_definition': ('function', None),   # outer decorator wrapper
    # JS / TS
    'function_declaration': ('function', 'name'),
    'class_declaration': ('class', 'name'),
    'method_definition': ('method', 'name'),
    'arrow_function': ('function', None),
    'export_statement': ('module', None),
    'lexical_declaration': ('function', None),    # const fn = () => ...
}


def _extract_name_from_node(node, source_bytes: bytes) -> str:
    """Try to pull the identifier name from a Tree-sitter node."""
    for child in node.children:
        if child.type in ('identifier', 'property_identifier', 'type_identifier'):
            return source_bytes[child.start_byte:child.end_byte].decode('utf-8', errors='replace')
    return ''


def _ast_chunks(file_path_rel: str, source: str, parser) -> list[dict]:
    """Extract symbol-level chunks using Tree-sitter AST."""
    source_bytes = source.encode('utf-8')
    try:
        tree = parser.parse(source_bytes)
    except Exception:
        return []

    chunks: list[dict] = []
    lines = source.splitlines()

    def walk(node):
        sym_type, name_field = _SYMBOL_NODE_TYPES.get(node.type, (None, None))
        if sym_type:
            start_line = node.start_point[0]  # 0-indexed
            end_line = node.end_point[0]      # 0-indexed
            symbol_name = _extract_name_from_node(node, source_bytes) if name_field is not None else ''

            # Grab content, capped
            chunk_lines = lines[start_line:end_line + 1]
            content = '\n'.join(chunk_lines)[:MAX_CHUNK_CONTENT]

            if content.strip():
                chunks.append({
                    'file_path': file_path_rel,
                    'symbol_name': symbol_name,
                    'symbol_type': sym_type,
                    'start_line': start_line + 1,   # convert to 1-indexed
                    'end_line': end_line + 1,
                    'content': content,
                })
            return  # Don't recurse inside extracted symbol blocks

        for child in node.children:
            walk(child)

    walk(tree.root_node)

    # Deduplicate by exact (start_line, end_line) to remove nested duplicates
    seen = set()
    unique: list[dict] = []
    for c in chunks:
        key = (c['start_line'], c['end_line'])
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique


def _block_chunks(file_path_rel: str, source: str) -> list[dict]:
    """Sliding-window block chunker for files without AST support."""
    lines = source.splitlines()
    chunks: list[dict] = []
    i = 0
    while i < len(lines):
        block = lines[i: i + BLOCK_CHUNK_LINES]
        content = '\n'.join(block)[:MAX_CHUNK_CONTENT]
        if content.strip():
            chunks.append({
                'file_path': file_path_rel,
                'symbol_name': '',
                'symbol_type': 'block',
                'start_line': i + 1,
                'end_line': min(i + BLOCK_CHUNK_LINES, len(lines)),
                'content': content,
            })
        i += BLOCK_CHUNK_LINES - BLOCK_OVERLAP_LINES
    return chunks


# ─── Public API ────────────────────────────────────────────────────────────────

def _should_skip(path: Path) -> bool:
    """Return True if this path should be ignored."""
    # Skip hidden or blacklisted directories anywhere in the path
    for part in path.parts:
        if part.startswith('.') and part not in ('.env.example',):
            return True
        if part in SKIP_DIRS:
            return True

    # Skip by extension
    suffix = path.suffix.lower()
    if suffix in SKIP_EXTENSIONS:
        return True

    # Detect minified compound extensions like .min.js
    name_lower = path.name.lower()
    if '.min.' in name_lower:
        return True

    # Skip lockfiles
    if path.name in ('package-lock.json', 'yarn.lock', 'poetry.lock', 'Cargo.lock', 'Pipfile.lock'):
        return True

    # Skip very large files (likely generated / minified)
    try:
        if path.stat().st_size > MAX_FILE_SIZE_BYTES:
            return True
    except OSError:
        return True

    return False


def chunk_repository(repo_path: str) -> list[dict]:
    """
    Walk the repository directory and extract all code chunks.

    Returns a list of chunk dicts ready to be embedded and stored as CodeChunk records.
    """
    root = Path(repo_path)
    parsers = _get_parsers()
    all_chunks: list[dict] = []

    for file_path in sorted(root.rglob('*')):
        if not file_path.is_file():
            continue
        if _should_skip(file_path):
            continue

        relative = str(file_path.relative_to(root))

        try:
            source = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue

        if not source.strip():
            continue

        suffix = file_path.suffix.lower()
        parser = parsers.get(suffix)

        if parser:
            chunks = _ast_chunks(relative, source, parser)
            # If AST produced nothing meaningful, fall back to block
            if not chunks:
                chunks = _block_chunks(relative, source)
        else:
            chunks = _block_chunks(relative, source)

        all_chunks.extend(chunks)

    logger.info('chunk_repository: %d chunks extracted from %s', len(all_chunks), repo_path)
    return all_chunks
