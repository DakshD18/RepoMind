"""
AST-Aware Code Chunker (Phase 2.1 — RAG Accuracy Upgrade).

Improvements over Phase 2:
- Qualified symbol names (e.g. "JWTService.generate_token" for methods).
- Sub-chunking for large symbols (> MAX_AST_CHUNK_LINES lines) with 10-line overlap
  while preserving parent symbol metadata.
- Enriched chunk metadata dict includes 'class_name' for methods inside classes.
- format_chunk_for_embedding() builds the structured text fed into SentenceTransformers,
  giving the embedder rich context: repo name, file path, class, function, type, code.
- Broader language support: also handles .java via block chunking (Tree-sitter Java omitted
  for simplicity; Java support can be added later by importing tree-sitter-java).
- All Phase 2 file-filtering rules preserved.

Each chunk is a dict:
    {
        'file_path': str,          # relative to repo root
        'symbol_name': str,        # possibly qualified: "ClassName.method_name"
        'class_name': str,         # enclosing class name (if method), else ''
        'symbol_type': str,        # 'function' | 'class' | 'method' | 'module' | 'block'
        'start_line': int,         # 1-indexed
        'end_line': int,           # 1-indexed inclusive
        'content': str,            # actual source code (possibly truncated for large symbols)
    }
"""

import os
import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── File filtering ────────────────────────────────────────────────────────────

SKIP_DIRS = {
    '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env',
    'dist', 'build', '.next', '.cache', 'vendor', '.mypy_cache',
    '.pytest_cache', 'coverage', '.tox', 'target', 'htmlcov',
    'site-packages', 'eggs', '.eggs', 'migrations',
    'artifacts', 'backups', 'tcpdf', 'TCPDF', 'fonts', 'font-awesome',
}

SKIP_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp4', '.mp3', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.bz2', '.7z',
    '.woff', '.woff2', '.ttf', '.eot', '.otf', '.z', '.ctg.z',
    '.icc', '.ai', '.fdf', '.p12',
    '.pdf', '.docx', '.xlsx', '.xls', '.pptx',
    '.pyc', '.pyo', '.pyd', '.class', '.so', '.dll', '.dylib',
    '.db', '.sqlite3',
    '.lock',        # yarn.lock, Cargo.lock etc. handled below by name too
    '.csv',         # usually data, not code
    '.parquet', '.pkl', '.pickle', '.joblib', '.npy', '.npz',
    '.bin', '.onnx', '.pt', '.pth',
}

SKIP_FILENAMES = {
    'package-lock.json', 'yarn.lock', 'poetry.lock', 'Cargo.lock',
    'Pipfile.lock', 'composer.lock', 'Gemfile.lock',
    '.DS_Store', 'Thumbs.db',
    'license', 'license.txt', 'license.md', 'license-mit', 'license-apache',
    'copying', 'patents', 'notice',
}

MAX_FILE_SIZE_BYTES = 150_000     # 150 KB — skip likely minified / huge files
MAX_AST_CHUNK_LINES = 60          # Split symbols larger than this
AST_CHUNK_OVERLAP = 10            # Overlap lines when sub-chunking large symbols
MAX_CHUNK_CONTENT = 3_000         # Char cap per sub-chunk
BLOCK_CHUNK_LINES = 40            # Lines per block chunk for non-AST files
BLOCK_OVERLAP_LINES = 8           # Overlap between blocks


# ─── Tree-sitter setup ─────────────────────────────────────────────────────────

def _load_ts_parsers():
    """Lazily load Tree-sitter parsers; return dict or empty dict on failure."""
    try:
        import tree_sitter_python as tspython
        import tree_sitter_javascript as tsjavascript
        import tree_sitter_typescript as tstypescript
        from tree_sitter import Language, Parser

        parsers = {
            '.py':  Parser(Language(tspython.language())),
            '.js':  Parser(Language(tsjavascript.language())),
            '.jsx': Parser(Language(tsjavascript.language())),
            '.ts':  Parser(Language(tstypescript.language_typescript())),
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


# ─── Symbol node types ─────────────────────────────────────────────────────────

# Maps Tree-sitter node type → (symbol_type, has_name)
_TOP_LEVEL_NODES = {
    'function_definition':   'function',    # Python
    'class_definition':      'class',       # Python
    'function_declaration':  'function',    # JS/TS
    'class_declaration':     'class',       # JS/TS
    'method_definition':     'method',      # JS/TS
    'lexical_declaration':   'function',    # JS/TS: const fn = () => ...
    'export_statement':      'module',      # JS/TS: export default ...
}

# For Python: method inside class uses function_definition node too
_PYTHON_METHOD_PARENT = 'class_definition'


def _node_text(node, source_bytes: bytes) -> str:
    """Extract raw text for a node."""
    return source_bytes[node.start_byte:node.end_byte].decode('utf-8', errors='replace')


def _extract_identifier(node, source_bytes: bytes) -> str:
    """Pull the first identifier-like child from a node."""
    for child in node.children:
        if child.type in ('identifier', 'property_identifier', 'type_identifier'):
            return source_bytes[child.start_byte:child.end_byte].decode('utf-8', errors='replace')
    return ''


def _extract_lexical_name(node, source_bytes: bytes) -> str:
    """For JS 'const fn = ...' — grab the variable declarator's name."""
    for child in node.children:
        if child.type == 'variable_declarator':
            return _extract_identifier(child, source_bytes)
    return _extract_identifier(node, source_bytes)


# ─── Sub-chunking large symbols ────────────────────────────────────────────────

def _sub_chunk(
    file_path: str,
    symbol_name: str,
    class_name: str,
    symbol_type: str,
    lines: list[str],
    start_line_1: int,
) -> list[dict]:
    """
    Split a large symbol into overlapping sub-chunks.
    Each sub-chunk carries the parent symbol metadata for retrieval context.
    start_line_1 is 1-indexed.
    """
    chunks = []
    n = len(lines)
    i = 0
    while i < n:
        end_i = min(i + MAX_AST_CHUNK_LINES, n)
        block_lines = lines[i:end_i]
        content = '\n'.join(block_lines)[:MAX_CHUNK_CONTENT]
        if content.strip():
            chunks.append({
                'file_path': file_path,
                'symbol_name': symbol_name,
                'class_name': class_name,
                'symbol_type': symbol_type,
                'start_line': start_line_1 + i,
                'end_line': start_line_1 + end_i - 1,
                'content': content,
            })
        i += MAX_AST_CHUNK_LINES - AST_CHUNK_OVERLAP
        if i >= n:
            break
    return chunks


# ─── AST-based chunking ────────────────────────────────────────────────────────

def _ast_chunks(file_path_rel: str, source: str, parser, lang: str = '') -> list[dict]:
    """
    Extract symbol-level chunks using Tree-sitter AST.

    Qualifies method names with their enclosing class name.
    Sub-chunks large symbols. Deduplicates overlapping line ranges.
    """
    if not lang:
        lang = Path(file_path_rel).suffix.lower()
    source_bytes = source.encode('utf-8')
    try:
        tree = parser.parse(source_bytes)
    except Exception:
        return []

    lines = source.splitlines()
    chunks: list[dict] = []
    is_python = (lang == '.py')

    def walk(node, enclosing_class: str = ''):
        ntype = node.type
        sym_type = _TOP_LEVEL_NODES.get(ntype)

        if sym_type:
            # Extract symbol name
            if ntype == 'lexical_declaration':
                sym_name = _extract_lexical_name(node, source_bytes)
            elif ntype == 'export_statement':
                # Recurse into export to find the actual declaration
                for child in node.children:
                    walk(child, enclosing_class)
                return
            else:
                sym_name = _extract_identifier(node, source_bytes)

            # Qualify method names with class name
            class_name = enclosing_class
            if sym_type == 'method' and enclosing_class:
                qualified = f'{enclosing_class}.{sym_name}' if sym_name else enclosing_class
            elif sym_type == 'function' and is_python and enclosing_class:
                # Python method inside class
                sym_type = 'method'
                qualified = f'{enclosing_class}.{sym_name}' if sym_name else enclosing_class
            else:
                qualified = sym_name

            start_0 = node.start_point[0]  # 0-indexed
            end_0 = node.end_point[0]
            node_lines = lines[start_0:end_0 + 1]
            line_count = len(node_lines)

            # For class nodes: emit a class-level header chunk + recurse into children
            if sym_type == 'class':
                # Emit small header (first 15 lines) as class chunk
                header_lines = node_lines[:15]
                header_content = '\n'.join(header_lines)[:MAX_CHUNK_CONTENT]
                if header_content.strip():
                    chunks.append({
                        'file_path': file_path_rel,
                        'symbol_name': sym_name,
                        'class_name': '',
                        'symbol_type': 'class',
                        'start_line': start_0 + 1,
                        'end_line': start_0 + min(15, line_count),
                        'content': header_content,
                    })
                # Recurse into class body so methods are extracted individually
                for child in node.children:
                    walk(child, enclosing_class=sym_name)
                return

            # Large symbol: sub-chunk it
            if line_count > MAX_AST_CHUNK_LINES:
                sub = _sub_chunk(
                    file_path=file_path_rel,
                    symbol_name=qualified,
                    class_name=class_name,
                    symbol_type=sym_type,
                    lines=node_lines,
                    start_line_1=start_0 + 1,
                )
                chunks.extend(sub)
            else:
                content = '\n'.join(node_lines)[:MAX_CHUNK_CONTENT]
                if content.strip():
                    chunks.append({
                        'file_path': file_path_rel,
                        'symbol_name': qualified,
                        'class_name': class_name,
                        'symbol_type': sym_type,
                        'start_line': start_0 + 1,
                        'end_line': end_0 + 1,
                        'content': content,
                    })
            # Don't recurse further inside non-class symbols
            return

        # Recurse into nodes we haven't handled yet
        for child in node.children:
            walk(child, enclosing_class)

    walk(tree.root_node)

    # Deduplicate by exact (start_line, end_line) pair
    seen: set = set()
    unique: list[dict] = []
    for c in chunks:
        key = (c['start_line'], c['end_line'], c['symbol_name'])
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique


# ─── Block chunker ─────────────────────────────────────────────────────────────

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
                'class_name': '',
                'symbol_type': 'block',
                'start_line': i + 1,
                'end_line': min(i + BLOCK_CHUNK_LINES, len(lines)),
                'content': content,
            })
        i += BLOCK_CHUNK_LINES - BLOCK_OVERLAP_LINES
    return chunks


# ─── File filter ───────────────────────────────────────────────────────────────

def _should_skip(path: Path) -> bool:
    """Return True if this path should be ignored during indexing."""
    for part in path.parts:
        if part.startswith('.') and part not in ('.env.example',):
            return True
        if part in SKIP_DIRS:
            return True

    suffix = path.suffix.lower()
    if suffix in SKIP_EXTENSIONS:
        return True

    name_lower = path.name.lower()
    if '.min.' in name_lower:
        return True

    if name_lower in SKIP_FILENAMES or name_lower.startswith('license') or name_lower.startswith('copying'):
        return True

    try:
        if path.stat().st_size > MAX_FILE_SIZE_BYTES:
            return True
    except OSError:
        return True

    return False


# ─── Embedding text formatter ──────────────────────────────────────────────────

def format_chunk_for_embedding(chunk: dict, repo_name: str = '') -> str:
    """
    Build the structured text string that gets fed into SentenceTransformers.

    Richer context → better embeddings → more accurate retrieval.

    Example output:
        Repository: RepoMind
        File: backend/authentication/services.py
        Class: JWTService
        Function: generate_token
        Type: method

        Code:
        def generate_token(user_id: int, ...):
            ...
    """
    parts = []
    if repo_name:
        parts.append(f'Repository: {repo_name}')

    parts.append(f"File: {chunk['file_path']}")

    class_name = chunk.get('class_name', '')
    sym_name = chunk.get('symbol_name', '')
    sym_type = chunk.get('symbol_type', 'block')

    # If qualified name already contains ClassName.method, don't double-add class
    if class_name and '.' not in sym_name:
        parts.append(f'Class: {class_name}')

    if sym_name:
        # Strip class prefix if already qualified (ClassName.method → method for label)
        label_name = sym_name.split('.')[-1] if '.' in sym_name else sym_name
        type_label = sym_type.capitalize()
        parts.append(f'{type_label}: {label_name}')

    parts.append(f'Type: {sym_type}')
    parts.append('')
    parts.append('Code:')
    parts.append(chunk.get('content', ''))

    return '\n'.join(parts)


# ─── Public API ────────────────────────────────────────────────────────────────

def chunk_repository(repo_path: str, repo_name: str = '') -> list[dict]:
    """
    Walk the repository directory and extract all code chunks.

    Returns a list of chunk dicts ready to be embedded and stored as CodeChunk records.
    Each dict also includes 'embedding_text' — the enriched string for embedding.
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
            chunks = _ast_chunks(relative, source, parser, lang=suffix)
            if not chunks:
                chunks = _block_chunks(relative, source)
        else:
            chunks = _block_chunks(relative, source)

        # Attach embedding text to each chunk
        for c in chunks:
            if 'class_name' not in c:
                c['class_name'] = ''
            c['embedding_text'] = format_chunk_for_embedding(c, repo_name=repo_name)

        all_chunks.extend(chunks)

    logger.info('chunk_repository: %d chunks extracted from %s', len(all_chunks), repo_path)
    return all_chunks
