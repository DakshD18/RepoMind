"""
Health Scanner Orchestrator for RepoMind Phase 5.

Orchestrates:
1. Safe file discovery and content collection with size and directory guards
2. Execution of deterministic analyzers (complexity, duplication, testing, documentation, dependencies)
3. Structured finding generation with explainable evidence, remediations, and stable fingerprints
4. Health score computation and letter grade assignment
5. Delta tracking between current and previous snapshot (score delta, new findings, resolved findings)
6. Transactional persistence and intelligent snapshot caching
"""

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set, Any

from django.db import transaction
from django.conf import settings

from repositories.models import Repository
from parser.services import SKIP_DIRS
from parser.chunker import SKIP_EXTENSIONS, SKIP_FILENAMES, MAX_FILE_SIZE_BYTES
from impact.graph import get_repository_revision

from ..models import RepositoryHealthSnapshot, HealthFinding
from .complexity import (
    analyze_file_complexity,
    FileComplexityResult,
    COMPLEXITY_ELEVATED_THRESHOLD,
    COMPLEXITY_SEVERE_THRESHOLD,
    FUNCTION_SIZE_WARN_THRESHOLD,
    FUNCTION_SIZE_HIGH_THRESHOLD,
    FILE_SIZE_WARN_THRESHOLD,
    FILE_SIZE_HIGH_THRESHOLD,
)
from .duplication import detect_code_duplication, DuplicationReport
from .testing import analyze_repository_testing, TestingReport
from .documentation import analyze_repository_documentation, DocumentationReport
from .dependencies import analyze_repository_dependencies, DependencyHealthReport
from .scoring import compute_overall_health_score, HealthScoreResult

logger = logging.getLogger(__name__)

CACHE_COOLDOWN_MINUTES = 15


def _generate_finding_fingerprint(
    category: str,
    finding_type: str,
    file_path: str,
    symbol_name: str = '',
) -> str:
    """
    Generate a stable SHA256 fingerprint for a finding.
    Excludes volatile line numbers so harmless line shifts do not falsely create new findings.
    """
    raw = f"{category}:{finding_type}:{file_path}:{symbol_name}".strip().lower()
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:32]


def discover_repository_files(repo_dir: Path) -> Tuple[List[str], Dict[str, str]]:
    """
    Safely discover all analyzable source files within repository directory.
    Returns (list_of_relative_paths, dict_of_file_contents).
    """
    all_rel_paths: List[str] = []
    file_contents: Dict[str, str] = {}

    import os
    for root_str, dirs, files in os.walk(repo_dir):
        root = Path(root_str)
        # Prune skipped directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]

        for fname in files:
            if fname in SKIP_FILENAMES or fname.startswith('.'):
                continue
            ext = Path(fname).suffix.lower()
            if ext in SKIP_EXTENSIONS:
                continue

            full_p = root / fname
            try:
                rel_p = str(full_p.relative_to(repo_dir))
            except ValueError:
                continue

            all_rel_paths.append(rel_p)

            # Skip excessively large files for content analysis
            try:
                size = full_p.stat().st_size
                if size <= MAX_FILE_SIZE_BYTES:
                    content = full_p.read_text(encoding='utf-8', errors='ignore')
                    file_contents[rel_p] = content
            except Exception as e:
                logger.debug("Failed reading file %s: %s", rel_p, e)

    return all_rel_paths, file_contents


def run_health_scan(
    repo: Repository,
    repo_dir: Path,
    force_rescan: bool = False,
) -> Tuple[RepositoryHealthSnapshot, Dict[str, Any]]:
    """
    Run full deterministic health analysis on the repository.
    Returns (snapshot, delta_info).
    """
    commit_sha = get_repository_revision(repo_dir)

    # 1. Snapshot Cache Check
    now = datetime.now(timezone.utc)
    if not force_rescan:
        latest = RepositoryHealthSnapshot.objects.filter(repository=repo).order_by('-created_at').first()
        if latest and latest.commit_sha == commit_sha:
            age = (now - latest.created_at).total_seconds()
            if age < (CACHE_COOLDOWN_MINUTES * 60):
                logger.info("Reusing cached health snapshot for %s @ %s", repo.name, commit_sha[:7])
                return latest, {'cached': True, 'score_diff': 0.0, 'newly_introduced': 0, 'resolved': 0}

    # 2. File Discovery
    all_rel_paths, file_contents = discover_repository_files(repo_dir)

    # 3. Complexity Analysis
    file_complexity_results: List[FileComplexityResult] = []
    total_functions = 0
    complex_functions_count = 0
    severe_functions_count = 0
    large_files_count = 0
    oversized_files_count = 0
    total_loc = 0

    findings_to_create: List[dict] = []
    file_metrics_list: List[dict] = []

    for rel_path, content in file_contents.items():
        comp_res = analyze_file_complexity(rel_path, content)
        file_complexity_results.append(comp_res)
        total_loc += comp_res.physical_loc

        # Check file size
        if comp_res.physical_loc > FILE_SIZE_HIGH_THRESHOLD:
            oversized_files_count += 1
            findings_to_create.append({
                'finding_type': 'OVERSIZED_FILE',
                'category': HealthFinding.Category.MAINTAINABILITY,
                'severity': HealthFinding.Severity.HIGH,
                'title': f"Oversized file: '{Path(rel_path).name}' ({comp_res.physical_loc} LOC)",
                'description': f"File exceeds the {FILE_SIZE_HIGH_THRESHOLD} line threshold. Oversized files often combine multiple responsibilities, increasing maintenance friction.",
                'file_path': rel_path,
                'start_line': 1,
                'end_line': comp_res.physical_loc,
                'symbol_name': '',
                'evidence': {'loc': comp_res.physical_loc, 'threshold': FILE_SIZE_HIGH_THRESHOLD},
                'recommendation': "Decompose this module into focused, single-responsibility submodules or services.",
                'estimated_effort': 'SIGNIFICANT',
            })
        elif comp_res.physical_loc > FILE_SIZE_WARN_THRESHOLD:
            large_files_count += 1
            findings_to_create.append({
                'finding_type': 'LARGE_FILE',
                'category': HealthFinding.Category.MAINTAINABILITY,
                'severity': HealthFinding.Severity.MEDIUM,
                'title': f"Large file: '{Path(rel_path).name}' ({comp_res.physical_loc} LOC)",
                'description': f"File exceeds the {FILE_SIZE_WARN_THRESHOLD} line warning threshold.",
                'file_path': rel_path,
                'start_line': 1,
                'end_line': comp_res.physical_loc,
                'symbol_name': '',
                'evidence': {'loc': comp_res.physical_loc, 'threshold': FILE_SIZE_WARN_THRESHOLD},
                'recommendation': "Consider extracting helper logic or components before this file grows further.",
                'estimated_effort': 'MODERATE',
            })

        # Function complexities
        file_findings_count = 0
        file_severities = set()

        for fn in comp_res.functions:
            total_functions += 1
            if fn.complexity > COMPLEXITY_SEVERE_THRESHOLD:
                severe_functions_count += 1
                file_findings_count += 1
                file_severities.add(HealthFinding.Severity.HIGH)
                findings_to_create.append({
                    'finding_type': 'SEVERE_CYCLOMATIC_COMPLEXITY',
                    'category': HealthFinding.Category.COMPLEXITY,
                    'severity': HealthFinding.Severity.HIGH,
                    'title': f"Severe complexity in '{fn.qualified_name}' (CC: {fn.complexity})",
                    'description': f"Function has cyclomatic complexity of {fn.complexity} (threshold: {COMPLEXITY_SEVERE_THRESHOLD}). High branching complexity makes unit testing difficult and increases defect risk.",
                    'file_path': rel_path,
                    'start_line': fn.start_line,
                    'end_line': fn.end_line,
                    'symbol_name': fn.qualified_name,
                    'evidence': {'complexity': fn.complexity, 'branches': fn.branch_count, 'threshold': COMPLEXITY_SEVERE_THRESHOLD},
                    'recommendation': "Refactor decision tree into separate helper functions or apply strategy pattern.",
                    'estimated_effort': 'MODERATE',
                })
            elif fn.complexity > COMPLEXITY_ELEVATED_THRESHOLD:
                complex_functions_count += 1
                file_findings_count += 1
                file_severities.add(HealthFinding.Severity.MEDIUM)
                findings_to_create.append({
                    'finding_type': 'ELEVATED_CYCLOMATIC_COMPLEXITY',
                    'category': HealthFinding.Category.COMPLEXITY,
                    'severity': HealthFinding.Severity.MEDIUM,
                    'title': f"Elevated complexity in '{fn.qualified_name}' (CC: {fn.complexity})",
                    'description': f"Function has cyclomatic complexity of {fn.complexity} (threshold: {COMPLEXITY_ELEVATED_THRESHOLD}).",
                    'file_path': rel_path,
                    'start_line': fn.start_line,
                    'end_line': fn.end_line,
                    'symbol_name': fn.qualified_name,
                    'evidence': {'complexity': fn.complexity, 'branches': fn.branch_count, 'threshold': COMPLEXITY_ELEVATED_THRESHOLD},
                    'recommendation': "Simplify boolean logic or break nested conditions into descriptive subroutines.",
                    'estimated_effort': 'QUICK_FIX',
                })

            # Check function size
            if fn.line_count > FUNCTION_SIZE_HIGH_THRESHOLD:
                findings_to_create.append({
                    'finding_type': 'MONOLITHIC_FUNCTION',
                    'category': HealthFinding.Category.MAINTAINABILITY,
                    'severity': HealthFinding.Severity.HIGH,
                    'title': f"Monolithic function: '{fn.qualified_name}' ({fn.line_count} LOC)",
                    'description': f"Function exceeds {FUNCTION_SIZE_HIGH_THRESHOLD} lines of code.",
                    'file_path': rel_path,
                    'start_line': fn.start_line,
                    'end_line': fn.end_line,
                    'symbol_name': fn.qualified_name,
                    'evidence': {'lines': fn.line_count, 'threshold': FUNCTION_SIZE_HIGH_THRESHOLD},
                    'recommendation': "Split this function into modular sub-tasks.",
                    'estimated_effort': 'MODERATE',
                })

        file_metrics_list.append({
            'file_path': rel_path,
            'language': comp_res.language,
            'line_count': comp_res.physical_loc,
            'function_count': len(comp_res.functions),
            'max_complexity': comp_res.max_complexity,
            'avg_complexity': comp_res.avg_complexity,
            'complex_functions_count': comp_res.complex_functions_count,
            'findings_count': file_findings_count,
            'severities': list(file_severities),
            'ast_supported': comp_res.ast_supported,
        })

    avg_complexity = round(
        sum(f.avg_complexity for f in file_complexity_results) / max(1, len(file_complexity_results)), 2
    )

    # 4. Code Duplication Analysis
    dup_report = detect_code_duplication(file_contents)
    for block in dup_report.duplicate_blocks:
        sev = HealthFinding.Severity.HIGH if block.duplicate_lines >= 15 else HealthFinding.Severity.MEDIUM
        findings_to_create.append({
            'finding_type': 'CODE_DUPLICATION',
            'category': HealthFinding.Category.DUPLICATION,
            'severity': sev,
            'title': f"Duplicated code block ({block.duplicate_lines} lines) between {Path(block.file_a).name} and {Path(block.file_b).name}",
            'description': f"Identical normalized logic found in {block.file_a} (lines {block.start_line_a}-{block.end_line_a}) and {block.file_b} (lines {block.start_line_b}-{block.end_line_b}).",
            'file_path': block.file_a,
            'start_line': block.start_line_a,
            'end_line': block.end_line_a,
            'symbol_name': '',
            'evidence': {
                'duplicate_lines': block.duplicate_lines,
                'target_file': block.file_b,
                'target_start_line': block.start_line_b,
                'target_end_line': block.end_line_b,
                'snippet_preview': block.snippet_preview,
            },
            'recommendation': "Extract common code into a shared utility function or component.",
            'estimated_effort': 'QUICK_FIX' if block.duplicate_lines < 15 else 'MODERATE',
        })

    # 5. Testing and Coverage Analysis
    testing_report = analyze_repository_testing(repo_dir, all_rel_paths)
    if testing_report.test_files_count == 0:
        findings_to_create.append({
            'finding_type': 'MISSING_TEST_SUITE',
            'category': HealthFinding.Category.TESTING,
            'severity': HealthFinding.Severity.HIGH,
            'title': "No automated test files detected",
            'description': "No standard test files (e.g. test_*.py, *.test.ts, tests/) were identified in the repository.",
            'file_path': '',
            'start_line': None,
            'end_line': None,
            'symbol_name': '',
            'evidence': {'test_files_count': 0, 'total_source_files': testing_report.total_source_files},
            'recommendation': "Introduce automated unit tests for core domain logic.",
            'estimated_effort': 'SIGNIFICANT',
        })
    elif testing_report.test_to_code_ratio < 0.10:
        findings_to_create.append({
            'finding_type': 'LOW_TEST_RATIO',
            'category': HealthFinding.Category.TESTING,
            'severity': HealthFinding.Severity.MEDIUM,
            'title': f"Low test-to-source file ratio ({testing_report.test_to_code_ratio * 100:.1f}%)",
            'description': f"Found {testing_report.test_files_count} test files compared to {testing_report.total_source_files} source files.",
            'file_path': '',
            'start_line': None,
            'end_line': None,
            'symbol_name': '',
            'evidence': {'ratio': testing_report.test_to_code_ratio, 'test_files': testing_report.test_files_count},
            'recommendation': "Expand test coverage for key modules.",
            'estimated_effort': 'MODERATE',
        })

    # 6. Documentation Analysis
    doc_report = analyze_repository_documentation(repo_dir, file_contents)
    if not doc_report.has_readme:
        findings_to_create.append({
            'finding_type': 'MISSING_README',
            'category': HealthFinding.Category.DOCUMENTATION,
            'severity': HealthFinding.Severity.MEDIUM,
            'title': "Missing or minimal README.md",
            'description': "Repository lacks a descriptive README.md document with installation and architectural guidance.",
            'file_path': 'README.md',
            'start_line': 1,
            'end_line': 1,
            'symbol_name': '',
            'evidence': {'readme_length': doc_report.readme_length},
            'recommendation': "Add a clear README.md explaining project purpose, setup, and architecture.",
            'estimated_effort': 'QUICK_FIX',
        })

    # 7. Dependency and Import Analysis
    dep_report = analyze_repository_dependencies(repo.id, repo_dir)
    for cycle in dep_report.circular_cycles:
        cycle_str = " -> ".join([Path(p).name for p in cycle])
        findings_to_create.append({
            'finding_type': 'CIRCULAR_DEPENDENCY',
            'category': HealthFinding.Category.ARCHITECTURE,
            'severity': HealthFinding.Severity.HIGH,
            'title': f"Circular dependency cycle: {cycle_str}",
            'description': f"Modules cyclically depend on each other: {' -> '.join(cycle)}.",
            'file_path': cycle[0],
            'start_line': 1,
            'end_line': None,
            'symbol_name': '',
            'evidence': {'cycle': cycle},
            'recommendation': "Break the circular dependency by introducing an interface, moving shared types, or using dependency injection.",
            'estimated_effort': 'MODERATE',
        })

    for syn_err in dep_report.syntax_errors:
        findings_to_create.append({
            'finding_type': 'SYNTAX_ERROR',
            'category': HealthFinding.Category.ARCHITECTURE,
            'severity': HealthFinding.Severity.CRITICAL,
            'title': f"Syntax error in '{syn_err.get('file', 'unknown')}'",
            'description': syn_err.get('error', 'Syntax error encountered during parsing.'),
            'file_path': syn_err.get('file', ''),
            'start_line': 1,
            'end_line': None,
            'symbol_name': '',
            'evidence': syn_err,
            'recommendation': "Fix the syntax error to ensure reliable AST parsing and compilation.",
            'estimated_effort': 'QUICK_FIX',
        })

    # 8. Health Scoring
    score_result = compute_overall_health_score(
        complexity_input={
            'total_functions': total_functions,
            'complex_functions_count': complex_functions_count,
            'severe_functions_count': severe_functions_count,
            'avg_complexity': avg_complexity,
        },
        maintainability_input={
            'total_files': len(file_complexity_results),
            'large_files_count': large_files_count,
            'oversized_files_count': oversized_files_count,
        },
        duplication_input={
            'duplication_percentage': dup_report.duplication_percentage,
            'duplicate_blocks_count': len(dup_report.duplicate_blocks),
        },
        testing_input={
            'test_files_count': testing_report.test_files_count,
            'test_to_code_ratio': testing_report.test_to_code_ratio,
            'coverage_status': testing_report.coverage_status,
            'coverage_percentage': testing_report.coverage_percentage,
        },
        documentation_input={
            'has_readme': doc_report.has_readme,
            'documented_symbols_ratio': doc_report.overall_doc_ratio,
            'total_public_symbols': doc_report.total_public_symbols,
        },
        dependencies_input={
            'circular_cycles_count': len(dep_report.circular_cycles),
            'syntax_errors_count': len(dep_report.syntax_errors),
            'unresolved_imports_count': len(dep_report.unresolved_imports),
        },
    )

    # Findings summary counts
    findings_summary = {
        'critical': sum(1 for f in findings_to_create if f['severity'] == HealthFinding.Severity.CRITICAL),
        'high': sum(1 for f in findings_to_create if f['severity'] == HealthFinding.Severity.HIGH),
        'medium': sum(1 for f in findings_to_create if f['severity'] == HealthFinding.Severity.MEDIUM),
        'low': sum(1 for f in findings_to_create if f['severity'] == HealthFinding.Severity.LOW),
        'info': sum(1 for f in findings_to_create if f['severity'] == HealthFinding.Severity.INFO),
        'total': len(findings_to_create),
    }

    metrics_summary = {
        'total_files_analyzed': len(file_complexity_results),
        'total_loc': total_loc,
        'total_functions': total_functions,
        'avg_cyclomatic_complexity': avg_complexity,
        'complex_functions_count': complex_functions_count,
        'severe_functions_count': severe_functions_count,
        'large_files_count': large_files_count,
        'oversized_files_count': oversized_files_count,
        'duplication_percentage': dup_report.duplication_percentage,
        'test_files_count': testing_report.test_files_count,
        'test_to_code_ratio': testing_report.test_to_code_ratio,
        'test_configs_detected': testing_report.test_configs_detected,
        'test_coverage_status': testing_report.coverage_status,
        'test_coverage_percent': testing_report.coverage_percentage,
        'has_readme': doc_report.has_readme,
        'documented_symbols_ratio': doc_report.overall_doc_ratio,
        'circular_dependencies_count': len(dep_report.circular_cycles),
        'syntax_errors_count': len(dep_report.syntax_errors),
        'unresolved_imports_count': len(dep_report.unresolved_imports),
    }

    # 9. Calculate Delta against previous snapshot
    previous_snapshot = RepositoryHealthSnapshot.objects.filter(repository=repo).order_by('-created_at').first()
    score_diff = 0.0
    newly_introduced = 0
    resolved = 0

    current_fingerprints = set()
    for f in findings_to_create:
        fp = _generate_finding_fingerprint(
            f['category'], f['finding_type'], f['file_path'], f.get('symbol_name', '')
        )
        f['fingerprint'] = fp
        current_fingerprints.add(fp)

    if previous_snapshot:
        score_diff = round(score_result.overall_score - previous_snapshot.overall_score, 1)
        prev_fingerprints = set(
            HealthFinding.objects.filter(snapshot=previous_snapshot).values_list('fingerprint', flat=True)
        )
        newly_introduced = len(current_fingerprints - prev_fingerprints)
        resolved = len(prev_fingerprints - current_fingerprints)

    # 10. Atomic Database Persistence
    with transaction.atomic():
        snapshot = RepositoryHealthSnapshot.objects.create(
            repository=repo,
            commit_sha=commit_sha,
            overall_score=score_result.overall_score,
            grade=score_result.grade,
            component_scores=score_result.component_scores,
            metrics_summary=metrics_summary,
            findings_summary=findings_summary,
            file_metrics=file_metrics_list,
        )

        finding_objs = [
            HealthFinding(
                snapshot=snapshot,
                repository=repo,
                finding_type=f['finding_type'],
                category=f['category'],
                severity=f['severity'],
                title=f['title'],
                description=f['description'],
                file_path=f['file_path'],
                start_line=f.get('start_line'),
                end_line=f.get('end_line'),
                symbol_name=f.get('symbol_name', ''),
                evidence=f.get('evidence', {}),
                recommendation=f['recommendation'],
                estimated_effort=f.get('estimated_effort', 'MODERATE'),
                is_effort_estimate=True,
                is_ai_inferred=False,
                fingerprint=f['fingerprint'],
            )
            for f in findings_to_create
        ]
        HealthFinding.objects.bulk_create(finding_objs)

    delta_info = {
        'cached': False,
        'score_diff': score_diff,
        'newly_introduced': newly_introduced,
        'resolved': resolved,
        'previous_score': previous_snapshot.overall_score if previous_snapshot else None,
    }

    return snapshot, delta_info
