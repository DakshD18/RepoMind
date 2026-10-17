"""
Code Complexity and Size Analyzer for RepoMind Phase 5.

Calculates:
- Function-level McCabe Cyclomatic Complexity (Python AST and JS/TS Tree-sitter)
- Physical & logical line counts for files and functions
- Identifies oversized files (>400 LOC, >800 LOC) and oversized functions (>50 LOC, >100 LOC)
- Flags elevated (>10) and severe (>20) complexity hotspots
- Explicitly handles unsupported languages without fabricating metrics
"""

import ast
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from parser.chunker import _get_parsers

logger = logging.getLogger(__name__)

# Configurable thresholds
COMPLEXITY_ELEVATED_THRESHOLD = 10
COMPLEXITY_SEVERE_THRESHOLD = 20
FUNCTION_SIZE_WARN_THRESHOLD = 50
FUNCTION_SIZE_HIGH_THRESHOLD = 100
FILE_SIZE_WARN_THRESHOLD = 400
FILE_SIZE_HIGH_THRESHOLD = 800


@dataclass
class FunctionComplexity:
    name: str
    class_name: str
    qualified_name: str
    start_line: int
    end_line: int
    line_count: int
    complexity: int
    branch_count: int


@dataclass
class FileComplexityResult:
    file_path: str
    language: str
    physical_loc: int
    logical_loc: int
    functions: List[FunctionComplexity] = field(default_factory=list)
    max_complexity: int = 1
    avg_complexity: float = 1.0
    complex_functions_count: int = 0
    severe_functions_count: int = 0
    ast_supported: bool = True
    syntax_valid: bool = True
    error_message: str = ''


# ─── Python Complexity Analyzer (Standard Library AST) ─────────────────────────

def _count_python_branches(node: ast.AST) -> int:
    """
    Count branching constructs within a Python AST node (excluding nested functions/classes).
    """
    branches = 0
    for child in ast.iter_child_nodes(node):
        # Do not recurse into nested function or class definitions — they have their own scope
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue

        if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
            branches += 1
        elif isinstance(child, ast.ExceptHandler):
            branches += 1
        elif isinstance(child, (ast.With, ast.AsyncWith)):
            # With blocks represent resource control branching
            branches += 1
        elif isinstance(child, ast.IfExp):
            # Ternary: a if b else c
            branches += 1
        elif isinstance(child, ast.BoolOp):
            # Each operator beyond the first is a branch (e.g. A and B -> 1; A and B and C -> 2)
            branches += max(0, len(child.values) - 1)
        elif isinstance(child, ast.comprehension):
            # 'for x in y' is a loop (+1), plus any 'if z' filter (+1 each)
            branches += 1 + len(child.ifs)
        elif hasattr(ast, 'Match') and isinstance(child, ast.Match):  # Python 3.10+
            # Match cases
            branches += max(0, len(child.cases))

        branches += _count_python_branches(child)
    return branches


def analyze_python_complexity(file_path_rel: str, source_code: str) -> FileComplexityResult:
    """Analyze complexity for a Python file."""
    lines = source_code.splitlines()
    physical_loc = len(lines)
    logical_loc = sum(1 for line in lines if line.strip() and not line.strip().startswith('#'))

    result = FileComplexityResult(
        file_path=file_path_rel,
        language='Python',
        physical_loc=physical_loc,
        logical_loc=logical_loc,
        ast_supported=True,
    )

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

    functions: List[FunctionComplexity] = []

    def visit_class_or_module(node: ast.AST, current_class: str = ''):
        for item in node.body if hasattr(node, 'body') else []:
            if isinstance(item, ast.ClassDef):
                cls_name = f"{current_class}.{item.name}" if current_class else item.name
                visit_class_or_module(item, cls_name)
            elif isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                fn_name = item.name
                qual_name = f"{current_class}.{fn_name}" if current_class else fn_name
                start_l = item.lineno
                end_l = getattr(item, 'end_lineno', start_l)
                loc = end_l - start_l + 1
                branch_count = _count_python_branches(item)
                cyclomatic = 1 + branch_count

                functions.append(FunctionComplexity(
                    name=fn_name,
                    class_name=current_class,
                    qualified_name=qual_name,
                    start_line=start_l,
                    end_line=end_l,
                    line_count=loc,
                    complexity=cyclomatic,
                    branch_count=branch_count,
                ))
                # Also visit nested functions inside this function
                visit_class_or_module(item, qual_name)

    visit_class_or_module(tree)

    result.functions = functions
    if functions:
        result.max_complexity = max(f.complexity for f in functions)
        result.avg_complexity = round(sum(f.complexity for f in functions) / len(functions), 2)
        result.complex_functions_count = sum(1 for f in functions if f.complexity > COMPLEXITY_ELEVATED_THRESHOLD)
        result.severe_functions_count = sum(1 for f in functions if f.complexity > COMPLEXITY_SEVERE_THRESHOLD)
    else:
        result.max_complexity = 1
        result.avg_complexity = 1.0

    return result


# ─── JS / TS Complexity Analyzer (Tree-sitter) ─────────────────────────────────

_JS_TS_FUNCTION_TYPES = {
    'function_declaration',
    'function_expression',
    'generator_function_declaration',
    'method_definition',
    'arrow_function',
}

_JS_TS_BRANCH_TYPES = {
    'if_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'while_statement',
    'do_statement',
    'catch_clause',
    'conditional_expression',  # ternary
    'switch_case',
}


def _extract_ts_node_name(node, source_bytes: bytes) -> str:
    """Extract symbol name from a tree-sitter function/method node."""
    for child in node.children:
        if child.type in ('identifier', 'property_identifier'):
            return source_bytes[child.start_byte:child.end_byte].decode('utf-8', errors='replace')
    # If arrow function in variable declaration: const myFn = () => ...
    parent = node.parent
    if parent and parent.type == 'variable_declarator':
        for child in parent.children:
            if child.type == 'identifier':
                return source_bytes[child.start_byte:child.end_byte].decode('utf-8', errors='replace')
    return '<anonymous>'


def _count_jsts_branches(node) -> int:
    """Count branches within a Tree-sitter JS/TS node, avoiding nested functions."""
    branches = 0
    for child in node.children:
        # Stop at nested function boundary
        if child.type in _JS_TS_FUNCTION_TYPES:
            continue

        if child.type in _JS_TS_BRANCH_TYPES:
            branches += 1
        elif child.type == 'binary_expression':
            # Check for boolean operators && and ||
            op_node = child.child_by_field_name('operator')
            if op_node and op_node.text in (b'&&', b'||', b'??'):
                branches += 1

        branches += _count_jsts_branches(child)
    return branches


def analyze_jsts_complexity(file_path_rel: str, source_code: str, ext: str) -> FileComplexityResult:
    """Analyze complexity for JavaScript and TypeScript files using Tree-sitter."""
    lines = source_code.splitlines()
    physical_loc = len(lines)
    logical_loc = sum(1 for line in lines if line.strip() and not line.strip().startswith('//'))

    lang_name = 'TypeScript' if 'ts' in ext else 'JavaScript'
    result = FileComplexityResult(
        file_path=file_path_rel,
        language=lang_name,
        physical_loc=physical_loc,
        logical_loc=logical_loc,
        ast_supported=True,
    )

    parsers = _get_parsers()
    parser = parsers.get(ext)
    if not parser:
        result.ast_supported = False
        return result

    try:
        source_bytes = source_code.encode('utf-8')
        tree = parser.parse(source_bytes)
    except Exception as e:
        result.syntax_valid = False
        result.error_message = f"Tree-sitter parse error: {str(e)}"
        return result

    functions: List[FunctionComplexity] = []

    def walk_tree(node, current_class: str = ''):
        nonlocal functions
        if node.type in ('class_declaration', 'class_definition'):
            cls_name = ''
            for child in node.children:
                if child.type == 'type_identifier' or child.type == 'identifier':
                    cls_name = source_bytes[child.start_byte:child.end_byte].decode('utf-8', errors='replace')
                    break
            sub_cls = f"{current_class}.{cls_name}" if current_class and cls_name else (cls_name or current_class)
            for child in node.children:
                walk_tree(child, sub_cls)
            return

        if node.type in _JS_TS_FUNCTION_TYPES:
            fn_name = _extract_ts_node_name(node, source_bytes)
            qual_name = f"{current_class}.{fn_name}" if current_class and fn_name != '<anonymous>' else fn_name
            start_l = node.start_point[0] + 1
            end_l = node.end_point[0] + 1
            loc = end_l - start_l + 1
            branch_count = _count_jsts_branches(node)
            cyclomatic = 1 + branch_count

            functions.append(FunctionComplexity(
                name=fn_name,
                class_name=current_class,
                qualified_name=qual_name,
                start_line=start_l,
                end_line=end_l,
                line_count=loc,
                complexity=cyclomatic,
                branch_count=branch_count,
            ))

            for child in node.children:
                walk_tree(child, qual_name)
            return

        for child in node.children:
            walk_tree(child, current_class)

    walk_tree(tree.root_node)

    result.functions = functions
    if functions:
        result.max_complexity = max(f.complexity for f in functions)
        result.avg_complexity = round(sum(f.complexity for f in functions) / len(functions), 2)
        result.complex_functions_count = sum(1 for f in functions if f.complexity > COMPLEXITY_ELEVATED_THRESHOLD)
        result.severe_functions_count = sum(1 for f in functions if f.complexity > COMPLEXITY_SEVERE_THRESHOLD)
    else:
        result.max_complexity = 1
        result.avg_complexity = 1.0

    return result


# ─── Unified File Complexity Entry Point ────────────────────────────────────────

def analyze_file_complexity(file_path_rel: str, source_code: str) -> FileComplexityResult:
    """
    Main entry point for calculating complexity of any source file.
    Routes to Python AST, Tree-sitter JS/TS, or graceful unsupported fallback.
    """
    ext = Path(file_path_rel).suffix.lower()

    if ext == '.py':
        return analyze_python_complexity(file_path_rel, source_code)
    elif ext in ('.js', '.jsx', '.ts', '.tsx'):
        return analyze_jsts_complexity(file_path_rel, source_code, ext)
    else:
        # Non-AST language: calculate line counts without inventing false complexity
        lines = source_code.splitlines()
        physical_loc = len(lines)
        logical_loc = sum(1 for l in lines if l.strip())
        return FileComplexityResult(
            file_path=file_path_rel,
            language=ext.lstrip('.').capitalize() or 'Unknown',
            physical_loc=physical_loc,
            logical_loc=logical_loc,
            functions=[],
            max_complexity=1,
            avg_complexity=1.0,
            complex_functions_count=0,
            severe_functions_count=0,
            ast_supported=False,
        )
