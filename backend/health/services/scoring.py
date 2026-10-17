"""
Explainable Health Scoring Engine for RepoMind Phase 5.

Component Weights:
- Code complexity: 25%
- Maintainability and architecture: 20%
- Code duplication: 15%
- Testing indicators: 20%
- Documentation: 10%
- Dependencies and imports: 10%

Formula:
Overall Score = 0.25 * Complexity + 0.20 * Maintainability + 0.15 * Duplication +
                0.20 * Testing + 0.10 * Documentation + 0.10 * Dependencies

Grade Scale:
- 90.0 - 100.0: A+
- 80.0 - 89.9:  A
- 70.0 - 79.9:  B
- 60.0 - 69.9:  C
- 50.0 - 59.9:  D
- Below 50.0:   F
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

WEIGHTS = {
    'complexity': 0.25,
    'maintainability': 0.20,
    'duplication': 0.15,
    'testing': 0.20,
    'documentation': 0.10,
    'dependencies': 0.10,
}


@dataclass
class ComponentScoreDetail:
    name: str
    weight: float
    score: float
    deductions: List[str]
    evidence: Dict[str, any]


@dataclass
class HealthScoreResult:
    overall_score: float
    grade: str
    component_scores: Dict[str, float]
    score_details: Dict[str, ComponentScoreDetail]
    explanation: str


def get_letter_grade(score: float) -> str:
    """Return letter grade based on overall score."""
    if score >= 90.0:
        return 'A+'
    elif score >= 80.0:
        return 'A'
    elif score >= 70.0:
        return 'B'
    elif score >= 60.0:
        return 'C'
    elif score >= 50.0:
        return 'D'
    else:
        return 'F'


def calculate_complexity_score(
    total_functions: int,
    complex_functions_count: int,
    severe_functions_count: int,
    avg_complexity: float,
) -> Tuple[float, List[str]]:
    """
    Complexity Score (0 - 100):
    Base = 100.
    Deduct 3 points per complex function (CC > 10).
    Deduct 8 points per severe function (CC > 20).
    Deduct 5 points if average complexity > 5.0.
    """
    score = 100.0
    deductions = []

    if severe_functions_count > 0:
        pen = min(35.0, severe_functions_count * 8.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {severe_functions_count} functions with severe complexity (CC > 20)")

    if complex_functions_count > 0:
        pen = min(30.0, complex_functions_count * 3.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {complex_functions_count} functions with elevated complexity (CC > 10)")

    if avg_complexity > 5.0:
        pen = min(15.0, (avg_complexity - 5.0) * 3.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: Average cyclomatic complexity is elevated ({avg_complexity:.1f})")

    return max(0.0, min(100.0, round(score, 1))), deductions


def calculate_maintainability_score(
    total_files: int,
    large_files_count: int,
    oversized_files_count: int,
) -> Tuple[float, List[str]]:
    """
    Maintainability Score (0 - 100):
    Base = 100.
    Deduct 5 points per large file (>400 LOC).
    Deduct 12 points per oversized god-file (>800 LOC).
    """
    score = 100.0
    deductions = []

    if oversized_files_count > 0:
        pen = min(40.0, oversized_files_count * 12.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {oversized_files_count} oversized files (>800 LOC)")

    if large_files_count > 0:
        pen = min(30.0, large_files_count * 5.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {large_files_count} large files (>400 LOC)")

    return max(0.0, min(100.0, round(score, 1))), deductions


def calculate_duplication_score(duplication_percentage: float) -> Tuple[float, List[str]]:
    """
    Duplication Score (0 - 100):
    100 minus duplication penalty (3x the duplication percentage).
    0% dup -> 100 pts.
    5% dup -> 85 pts.
    10% dup -> 70 pts.
    20% dup -> 40 pts.
    """
    deductions = []
    pen = min(70.0, duplication_percentage * 3.0)
    score = max(0.0, 100.0 - pen)

    if duplication_percentage > 0.0:
        deductions.append(f"-{pen:.1f} pts: {duplication_percentage:.1f}% code duplication detected")

    return max(0.0, min(100.0, round(score, 1))), deductions


def calculate_testing_score(
    test_files_count: int,
    test_to_code_ratio: float,
    coverage_status: str,
    coverage_percentage: Optional[float],
) -> Tuple[float, List[str]]:
    """
    Testing Score (0 - 100):
    - If real coverage report is available: directly use coverage_percentage.
    - If coverage is UNAVAILABLE: scale fairly based on test file presence and ratio.
      Never penalize as 0% coverage!
    """
    deductions = []

    if coverage_status == 'REPORT_AVAILABLE' and coverage_percentage is not None:
        score = max(0.0, min(100.0, coverage_percentage))
        if score < 80.0:
            deductions.append(f"-{80.0 - score:.1f} pts below 80% target coverage (measured: {score:.1f}%)")
        return round(score, 1), deductions

    # Coverage unavailable fallback heuristic: based on test files ratio
    if test_files_count == 0:
        deductions.append("0 pts: No automated test files detected")
        return 20.0, deductions  # baseline when tests not found

    # Ratio of 0.25+ test files gives 90+ score
    score = min(100.0, 50.0 + (test_to_code_ratio * 200.0))
    if test_to_code_ratio < 0.15:
        deductions.append(f"Low test-to-source ratio ({test_to_code_ratio:.2f})")

    return round(score, 1), deductions


def calculate_documentation_score(
    has_readme: bool,
    documented_symbols_ratio: float,
    total_public_symbols: int,
) -> Tuple[float, List[str]]:
    """
    Documentation Score (0 - 100):
    40 pts for README presence.
    60 pts for docstring coverage ratio.
    """
    score = 0.0
    deductions = []

    if has_readme:
        score += 40.0
    else:
        deductions.append("-40.0 pts: Missing or empty README.md")

    if total_public_symbols == 0:
        score += 60.0
    else:
        doc_pts = 60.0 * documented_symbols_ratio
        score += doc_pts
        if documented_symbols_ratio < 0.5:
            deductions.append(f"-{60.0 - doc_pts:.1f} pts: Low docstring coverage ({documented_symbols_ratio * 100:.0f}%)")

    return max(0.0, min(100.0, round(score, 1))), deductions


def calculate_dependencies_score(
    circular_cycles_count: int,
    syntax_errors_count: int,
    unresolved_imports_count: int,
) -> Tuple[float, List[str]]:
    """
    Dependencies and Imports Score (0 - 100):
    Base = 100.
    Deduct 15 pts per circular cycle.
    Deduct 10 pts per syntax error.
    Deduct 2 pts per unresolved local import.
    """
    score = 100.0
    deductions = []

    if circular_cycles_count > 0:
        pen = min(40.0, circular_cycles_count * 15.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {circular_cycles_count} circular import cycles detected")

    if syntax_errors_count > 0:
        pen = min(30.0, syntax_errors_count * 10.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {syntax_errors_count} syntax errors in repository files")

    if unresolved_imports_count > 0:
        pen = min(20.0, unresolved_imports_count * 2.0)
        score -= pen
        deductions.append(f"-{pen:.1f} pts: {unresolved_imports_count} unresolved local imports")

    return max(0.0, min(100.0, round(score, 1))), deductions


def compute_overall_health_score(
    complexity_input: dict,
    maintainability_input: dict,
    duplication_input: dict,
    testing_input: dict,
    documentation_input: dict,
    dependencies_input: dict,
) -> HealthScoreResult:
    """
    Compute overall composite score, letter grade, and component details.
    """
    # 1. Complexity
    c_score, c_ded = calculate_complexity_score(
        total_functions=complexity_input.get('total_functions', 0),
        complex_functions_count=complexity_input.get('complex_functions_count', 0),
        severe_functions_count=complexity_input.get('severe_functions_count', 0),
        avg_complexity=complexity_input.get('avg_complexity', 1.0),
    )

    # 2. Maintainability
    m_score, m_ded = calculate_maintainability_score(
        total_files=maintainability_input.get('total_files', 0),
        large_files_count=maintainability_input.get('large_files_count', 0),
        oversized_files_count=maintainability_input.get('oversized_files_count', 0),
    )

    # 3. Duplication
    dup_score, dup_ded = calculate_duplication_score(
        duplication_percentage=duplication_input.get('duplication_percentage', 0.0),
    )

    # 4. Testing
    t_score, t_ded = calculate_testing_score(
        test_files_count=testing_input.get('test_files_count', 0),
        test_to_code_ratio=testing_input.get('test_to_code_ratio', 0.0),
        coverage_status=testing_input.get('coverage_status', 'UNAVAILABLE'),
        coverage_percentage=testing_input.get('coverage_percentage'),
    )

    # 5. Documentation
    doc_score, doc_ded = calculate_documentation_score(
        has_readme=documentation_input.get('has_readme', False),
        documented_symbols_ratio=documentation_input.get('documented_symbols_ratio', 1.0),
        total_public_symbols=documentation_input.get('total_public_symbols', 0),
    )

    # 6. Dependencies
    dep_score, dep_ded = calculate_dependencies_score(
        circular_cycles_count=dependencies_input.get('circular_cycles_count', 0),
        syntax_errors_count=dependencies_input.get('syntax_errors_count', 0),
        unresolved_imports_count=dependencies_input.get('unresolved_imports_count', 0),
    )

    # Weighted Sum
    overall = (
        c_score * WEIGHTS['complexity'] +
        m_score * WEIGHTS['maintainability'] +
        dup_score * WEIGHTS['duplication'] +
        t_score * WEIGHTS['testing'] +
        doc_score * WEIGHTS['documentation'] +
        dep_score * WEIGHTS['dependencies']
    )
    overall_rounded = round(max(0.0, min(100.0, overall)), 1)
    grade = get_letter_grade(overall_rounded)

    component_scores = {
        'complexity': c_score,
        'maintainability': m_score,
        'duplication': dup_score,
        'testing': t_score,
        'documentation': doc_score,
        'dependencies': dep_score,
    }

    score_details = {
        'complexity': ComponentScoreDetail(
            name='Code Complexity',
            weight=WEIGHTS['complexity'],
            score=c_score,
            deductions=c_ded,
            evidence=complexity_input,
        ),
        'maintainability': ComponentScoreDetail(
            name='Maintainability & Size',
            weight=WEIGHTS['maintainability'],
            score=m_score,
            deductions=m_ded,
            evidence=maintainability_input,
        ),
        'duplication': ComponentScoreDetail(
            name='Code Duplication',
            weight=WEIGHTS['duplication'],
            score=dup_score,
            deductions=dup_ded,
            evidence=duplication_input,
        ),
        'testing': ComponentScoreDetail(
            name='Testing Indicators',
            weight=WEIGHTS['testing'],
            score=t_score,
            deductions=t_ded,
            evidence=testing_input,
        ),
        'documentation': ComponentScoreDetail(
            name='Documentation Health',
            weight=WEIGHTS['documentation'],
            score=doc_score,
            deductions=doc_ded,
            evidence=documentation_input,
        ),
        'dependencies': ComponentScoreDetail(
            name='Dependencies & Imports',
            weight=WEIGHTS['dependencies'],
            score=dep_score,
            deductions=dep_ded,
            evidence=dependencies_input,
        ),
    }

    explanation = (
        f"Overall Health Score is {overall_rounded}/100 (Grade {grade}), computed from "
        f"Complexity ({c_score} × 25%), Maintainability ({m_score} × 20%), "
        f"Duplication ({dup_score} × 15%), Testing ({t_score} × 20%), "
        f"Documentation ({doc_score} × 10%), and Dependencies ({dep_score} × 10%)."
    )

    return HealthScoreResult(
        overall_score=overall_rounded,
        grade=grade,
        component_scores=component_scores,
        score_details=score_details,
        explanation=explanation,
    )
