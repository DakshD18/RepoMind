"""
Documentation Health Analyzer for RepoMind Phase 5.

Measures:
- README.md presence and meaningful content length (> 200 characters)
- Python docstrings on modules, classes, and public functions via standard ast
- JavaScript / TypeScript JSDoc comments attached to functions and exported declarations
- Ratio of documented public symbols to total public symbols
"""

import ast
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

README_MIN_CHARS = 200


@dataclass
class FileDocumentationInfo:
    file_path: str
    total_public_symbols: int
    documented_public_symbols: int
    docstring_ratio: float
    has_module_docstring: bool


@dataclass
class DocumentationReport:
    has_readme: bool
    readme_path: Optional[str]
    readme_length: int
    total_public_symbols: int
    documented_public_symbols: int
    overall_doc_ratio: float
    file_doc_info: Dict[str, FileDocumentationInfo] = field(default_factory=dict)


def analyze_python_documentation(file_path_rel: str, source_code: str) -> FileDocumentationInfo:
    """Analyze docstrings for Python files using AST."""
    total_public = 0
    documented_public = 0
    has_module_doc = False

    try:
        tree = ast.parse(source_code, filename=file_path_rel)
    except Exception:
        return FileDocumentationInfo(
            file_path=file_path_rel,
            total_public_symbols=0,
            documented_public_symbols=0,
            docstring_ratio=1.0,
            has_module_docstring=False,
        )

    has_module_doc = bool(ast.get_docstring(tree))

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            # Ignore private / protected symbols starting with single or double underscore
            if node.name.startswith('_'):
                continue

            total_public += 1
            if ast.get_docstring(node):
                documented_public += 1

    ratio = round(documented_public / max(1, total_public), 2) if total_public > 0 else 1.0

    return FileDocumentationInfo(
        file_path=file_path_rel,
        total_public_symbols=total_public,
        documented_public_symbols=documented_public,
        docstring_ratio=ratio,
        has_module_docstring=has_module_doc,
    )


def analyze_jsts_documentation(file_path_rel: str, source_code: str) -> FileDocumentationInfo:
    """Analyze JSDoc comments (/** ... */) preceding functions and exports in JS/TS."""
    lines = source_code.splitlines()
    total_public = 0
    documented_public = 0

    for idx, line in enumerate(lines):
        trimmed = line.strip()
        # Look for function or export declarations
        is_declaration = (
            trimmed.startswith('export function ') or
            trimmed.startswith('export const ') or
            trimmed.startswith('export class ') or
            trimmed.startswith('export default ') or
            (trimmed.startswith('function ') and not trimmed.startswith('function _'))
        )
        if is_declaration:
            total_public += 1
            # Check previous 3 lines for JSDoc or block comments
            has_doc = False
            for prev_idx in range(max(0, idx - 4), idx):
                prev_line = lines[prev_idx].strip()
                if '/**' in prev_line or '*/' in prev_line or prev_line.startswith('*'):
                    has_doc = True
                    break
            if has_doc:
                documented_public += 1

    ratio = round(documented_public / max(1, total_public), 2) if total_public > 0 else 1.0

    return FileDocumentationInfo(
        file_path=file_path_rel,
        total_public_symbols=total_public,
        documented_public_symbols=documented_public,
        docstring_ratio=ratio,
        has_module_docstring=False,
    )


def analyze_repository_documentation(
    repo_dir: Path,
    file_contents: Dict[str, str],
) -> DocumentationReport:
    """Analyze documentation across the entire repository."""
    # Check README
    has_readme = False
    readme_path = None
    readme_length = 0

    for cand in ['README.md', 'README.txt', 'readme.md', 'README']:
        full_cand = repo_dir / cand
        if full_cand.exists() and full_cand.is_file():
            try:
                content = full_cand.read_text(encoding='utf-8', errors='ignore')
                readme_length = len(content.strip())
                has_readme = readme_length >= README_MIN_CHARS
                readme_path = cand
                break
            except Exception:
                pass

    total_public = 0
    documented_public = 0
    file_doc_info: Dict[str, FileDocumentationInfo] = {}

    for file_path, content in file_contents.items():
        ext = Path(file_path).suffix.lower()
        if ext == '.py':
            info = analyze_python_documentation(file_path, content)
            file_doc_info[file_path] = info
            total_public += info.total_public_symbols
            documented_public += info.documented_public_symbols
        elif ext in ('.js', '.jsx', '.ts', '.tsx'):
            info = analyze_jsts_documentation(file_path, content)
            file_doc_info[file_path] = info
            total_public += info.total_public_symbols
            documented_public += info.documented_public_symbols

    overall_ratio = round(documented_public / max(1, total_public), 2) if total_public > 0 else 1.0

    return DocumentationReport(
        has_readme=has_readme,
        readme_path=readme_path,
        readme_length=readme_length,
        total_public_symbols=total_public,
        documented_public_symbols=documented_public,
        overall_doc_ratio=overall_ratio,
        file_doc_info=file_doc_info,
    )
