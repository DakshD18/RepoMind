"""
AST and Tree-sitter Code Parser for Impact Analysis.

Extracts:
- Import statements (module names, imported symbols, line numbers)
- Exported / defined symbols (classes, functions, constants)
- Symbol references / calls within the file to establish exact relationship types
"""

import ast
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Set, Optional

logger = logging.getLogger(__name__)


@dataclass
class RawImport:
    source_module: str              # e.g. "api.models" or "./components/Button"
    imported_names: List[str]       # e.g. ["User", "Ride"] or ["*"] or ["default"]
    line_number: int                # 1-indexed line number
    level: int = 0                  # 0 for absolute, 1 for ., 2 for .., etc. (Python)
    is_commonjs: bool = False       # True for require(...)


@dataclass
class FileParseResult:
    file_path: str                  # Relative to repo root
    language: str                   # 'python' | 'javascript' | 'typescript' | 'unknown'
    raw_imports: List[RawImport] = field(default_factory=list)
    defined_symbols: List[str] = field(default_factory=list)
    referenced_symbols: Set[str] = field(default_factory=set)
    syntax_valid: bool = True
    error_message: str = ''


# ─── Python Parser using standard ast ──────────────────────────────────────────

def parse_python_file(file_path_rel: str, source_code: str) -> FileParseResult:
    """Parse Python file using the built-in ast module."""
    result = FileParseResult(file_path=file_path_rel, language='python')

    try:
        tree = ast.parse(source_code, filename=file_path_rel)
    except SyntaxError as e:
        result.syntax_valid = False
        result.error_message = f"SyntaxError at line {e.lineno}: {e.msg}"
        return result
    except Exception as e:
        result.syntax_valid = False
        result.error_message = f"Parsing error: {str(e)}"
        return result

    for node in ast.walk(tree):
        # 1. Imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                result.raw_imports.append(RawImport(
                    source_module=alias.name,
                    imported_names=[alias.asname or alias.name],
                    line_number=getattr(node, 'lineno', 1),
                    level=0,
                ))
        elif isinstance(node, ast.ImportFrom):
            mod_name = node.module or ''
            names = [alias.name for alias in node.names]
            result.raw_imports.append(RawImport(
                source_module=mod_name,
                imported_names=names,
                line_number=getattr(node, 'lineno', 1),
                level=node.level or 0,
            ))

        # 2. Definitions / Exports
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result.defined_symbols.append(node.name)
        elif isinstance(node, ast.ClassDef):
            result.defined_symbols.append(node.name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    result.defined_symbols.append(target.id)

        # 3. Referenced identifiers and function calls
        elif isinstance(node, ast.Name):
            result.referenced_symbols.add(node.id)
        elif isinstance(node, ast.Attribute):
            result.referenced_symbols.add(node.attr)

    return result


# ─── JS / TS Parser using Tree-sitter ─────────────────────────────────────────

_PARSERS = None

def _get_ts_parsers():
    global _PARSERS
    if _PARSERS is None:
        try:
            import tree_sitter_javascript as tsjavascript
            import tree_sitter_typescript as tstypescript
            from tree_sitter import Language, Parser

            _PARSERS = {
                '.js': Parser(Language(tsjavascript.language())),
                '.jsx': Parser(Language(tsjavascript.language())),
                '.ts': Parser(Language(tstypescript.language_typescript())),
                '.tsx': Parser(Language(tstypescript.language_tsx())),
            }
        except Exception as e:
            logger.warning("Tree-sitter parser initialization failed: %s", e)
            _PARSERS = {}
    return _PARSERS


def parse_jsts_file(file_path_rel: str, source_code: str) -> FileParseResult:
    """Parse JavaScript / TypeScript files using Tree-sitter."""
    ext = Path(file_path_rel).suffix.lower()
    lang_name = 'typescript' if ext in ('.ts', '.tsx') else 'javascript'
    result = FileParseResult(file_path=file_path_rel, language=lang_name)

    parsers = _get_ts_parsers()
    parser = parsers.get(ext)

    if parser is None:
        # Fallback regex-based parsing if tree-sitter unavailable
        return _fallback_jsts_regex_parse(file_path_rel, source_code, lang_name)

    try:
        source_bytes = source_code.encode('utf-8')
        tree = parser.parse(source_bytes)
    except Exception as e:
        result.syntax_valid = False
        result.error_message = f"Tree-sitter parse error: {str(e)}"
        return result

    def get_text(node):
        return source_bytes[node.start_byte:node.end_byte].decode('utf-8', errors='replace')

    def walk(node):
        ntype = node.type

        # 1. Imports
        if ntype == 'import_statement':
            # import ... from 'source'
            source_mod = ''
            imported_names = []
            for child in node.children:
                if child.type == 'string':
                    source_mod = get_text(child).strip('\'"`')
                elif child.type == 'import_clause':
                    for sub in child.children:
                        if sub.type == 'identifier':
                            imported_names.append(get_text(sub))
                        elif sub.type == 'named_imports':
                            for spec in sub.children:
                                if spec.type == 'import_specifier':
                                    imported_names.append(get_text(spec.children[-1]))
                                elif spec.type == 'identifier':
                                    imported_names.append(get_text(spec))
            if source_mod:
                line_no = node.start_point[0] + 1
                result.raw_imports.append(RawImport(
                    source_module=source_mod,
                    imported_names=imported_names or ['default'],
                    line_number=line_no,
                ))

        # 2. CommonJS require('...')
        elif ntype == 'call_expression':
            fn_node = node.child_by_field_name('function')
            if fn_node and get_text(fn_node) == 'require':
                args_node = node.child_by_field_name('arguments')
                if args_node and args_node.children:
                    for arg in args_node.children:
                        if arg.type == 'string':
                            source_mod = get_text(arg).strip('\'"`')
                            line_no = node.start_point[0] + 1
                            result.raw_imports.append(RawImport(
                                source_module=source_mod,
                                imported_names=['*'],
                                line_number=line_no,
                                is_commonjs=True,
                            ))

        # 3. Export / Definitions
        elif ntype in ('function_declaration', 'class_declaration'):
            name_node = node.child_by_field_name('name')
            if name_node:
                result.defined_symbols.append(get_text(name_node))
        elif ntype == 'lexical_declaration':
            for child in node.children:
                if child.type == 'variable_declarator':
                    ident = child.child_by_field_name('name')
                    if ident:
                        result.defined_symbols.append(get_text(ident))

        # 4. References
        elif ntype in ('identifier', 'property_identifier', 'type_identifier'):
            result.referenced_symbols.add(get_text(node))

        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return result


def _fallback_jsts_regex_parse(file_path_rel: str, source_code: str, lang_name: str) -> FileParseResult:
    """Regex fallback for JS/TS import extraction if Tree-sitter is missing."""
    import re
    result = FileParseResult(file_path=file_path_rel, language=lang_name)
    # import ... from '...'
    import_re = re.compile(r"""(?:import\s+(?:([\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))""")
    for line_idx, line in enumerate(source_code.splitlines(), start=1):
        match = import_re.search(line)
        if match:
            symbols, import_source, req_source = match.groups()
            source = import_source or req_source
            if source:
                sym_list = []
                if symbols:
                    sym_list = [s.strip() for s in re.split(r'[,{}\s]+', symbols) if s.strip()]
                result.raw_imports.append(RawImport(
                    source_module=source,
                    imported_names=sym_list or ['default'],
                    line_number=line_idx,
                ))
    return result


def parse_source_file(file_path_rel: str, full_path: Path) -> Optional[FileParseResult]:
    """Parse a file based on its extension."""
    ext = full_path.suffix.lower()
    try:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        logger.warning("Could not read file %s: %s", full_path, e)
        return None

    if ext == '.py':
        return parse_python_file(file_path_rel, content)
    elif ext in ('.js', '.jsx', '.ts', '.tsx'):
        return parse_jsts_file(file_path_rel, content)

    return None
