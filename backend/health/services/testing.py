"""
Testing Indicators and Coverage Analyzer for RepoMind Phase 5.

Identifies:
- Automated test files across Python, JavaScript, TypeScript, and other languages
- Test configuration frameworks (pytest, jest, vitest, mocha, unittest)
- Real coverage report artifacts (coverage.xml, lcov.info, coverage-summary.json)
- Explicitly marks coverage as UNAVAILABLE when no coverage report exists.
  NEVER fabricates or assumes 0% coverage.
"""

import json
import logging
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)

TEST_FILE_PATTERNS = [
    # Python
    re.compile(r'(^|/)test_[^/]+\.py$', re.IGNORECASE),
    re.compile(r'(^|/)[^/]+_test\.py$', re.IGNORECASE),
    re.compile(r'(^|/)tests?\.py$', re.IGNORECASE),
    re.compile(r'(^|/)tests?/[^/]+\.py$', re.IGNORECASE),

    # JavaScript / TypeScript
    re.compile(r'\.(test|spec)\.(js|jsx|ts|tsx)$', re.IGNORECASE),
    re.compile(r'(^|/)__tests__/[^/]+\.(js|jsx|ts|tsx)$', re.IGNORECASE),
    re.compile(r'(^|/)tests?/[^/]+\.(js|jsx|ts|tsx)$', re.IGNORECASE),

    # Go, Rust, Java
    re.compile(r'_test\.go$', re.IGNORECASE),
    re.compile(r'Test[^/]+\.java$', re.IGNORECASE),
]

TEST_CONFIG_FILENAMES = {
    'pytest.ini',
    'setup.cfg',
    'tox.ini',
    '.coveragerc',
    'jest.config.js',
    'jest.config.ts',
    'jest.config.json',
    'vitest.config.ts',
    'vitest.config.js',
    '.mocharc.json',
    '.mocharc.js',
}

COVERAGE_FILENAMES = [
    'coverage.xml',
    'coverage-summary.json',
    'lcov.info',
    '.coverage',
]


@dataclass
class TestingReport:
    test_files_count: int
    test_files: List[str]
    total_source_files: int
    test_to_code_ratio: float
    test_configs_detected: List[str]
    coverage_status: str               # 'REPORT_AVAILABLE' | 'UNAVAILABLE'
    coverage_percentage: Optional[float]
    coverage_source_file: Optional[str]
    coverage_details: Dict[str, any] = field(default_factory=dict)


def is_test_file(rel_path: str) -> bool:
    """Check if relative path matches known test file patterns."""
    normalized = rel_path.replace('\\', '/')
    return any(p.search(normalized) for p in TEST_FILE_PATTERNS)


def parse_cobertura_xml(xml_content: str) -> Optional[float]:
    """Parse line-rate from Cobertura coverage.xml."""
    try:
        root = ET.fromstring(xml_content)
        # line-rate="0.842"
        rate_str = root.attrib.get('line-rate')
        if rate_str is not None:
            return round(float(rate_str) * 100.0, 2)
    except Exception as e:
        logger.debug("Failed parsing Cobertura XML: %s", e)
    return None


def parse_istanbul_summary_json(json_content: str) -> Optional[float]:
    """Parse line percentage from Istanbul/Jest coverage-summary.json."""
    try:
        data = json.loads(json_content)
        total = data.get('total', {})
        lines = total.get('lines', {})
        pct = lines.get('pct')
        if pct is not None:
            return round(float(pct), 2)
    except Exception as e:
        logger.debug("Failed parsing Istanbul JSON: %s", e)
    return None


def parse_lcov_info(lcov_content: str) -> Optional[float]:
    """Parse LF (lines found) and LH (lines hit) from lcov.info."""
    try:
        lines_found = 0
        lines_hit = 0
        for line in lcov_content.splitlines():
            if line.startswith('LF:'):
                lines_found += int(line.split(':')[1].strip())
            elif line.startswith('LH:'):
                lines_hit += int(line.split(':')[1].strip())
        if lines_found > 0:
            return round((lines_hit / lines_found) * 100.0, 2)
    except Exception as e:
        logger.debug("Failed parsing LCOV: %s", e)
    return None


def analyze_repository_testing(repo_dir: Path, all_relative_files: List[str]) -> TestingReport:
    """
    Analyze test presence and coverage reports for the repository.
    Strictly reports coverage as UNAVAILABLE if no real coverage artifact exists.
    """
    test_files: List[str] = []
    source_files_count = 0

    for f in all_relative_files:
        if is_test_file(f):
            test_files.append(f)
        else:
            source_files_count += 1

    test_to_code_ratio = round(len(test_files) / max(1, (source_files_count + len(test_files))), 3)

    # Detect test configs
    configs_detected: List[str] = []
    for f in all_relative_files:
        basename = Path(f).name.lower()
        if basename in TEST_CONFIG_FILENAMES:
            configs_detected.append(f)
        elif basename == 'pyproject.toml':
            try:
                full_path = repo_dir / f
                if full_path.exists() and 'tool.pytest' in full_path.read_text(errors='ignore'):
                    configs_detected.append(f"{f} ([tool.pytest])")
            except Exception:
                pass
        elif basename == 'package.json':
            try:
                full_path = repo_dir / f
                if full_path.exists():
                    pkg_data = json.loads(full_path.read_text(errors='ignore'))
                    scripts = pkg_data.get('scripts', {})
                    dev_deps = pkg_data.get('devDependencies', {})
                    if any('jest' in k or 'vitest' in k or 'mocha' in k for k in dev_deps) or 'test' in scripts:
                        configs_detected.append(f"{f} (test scripts/deps)")
            except Exception:
                pass

    # Search for coverage artifacts
    coverage_status = 'UNAVAILABLE'
    coverage_pct: Optional[float] = None
    coverage_file: Optional[str] = None
    coverage_details: Dict[str, any] = {}

    for cand_name in COVERAGE_FILENAMES:
        cand_path = repo_dir / cand_name
        if cand_path.exists() and cand_path.is_file():
            try:
                content = cand_path.read_text(encoding='utf-8', errors='ignore')
                if cand_name == 'coverage.xml':
                    parsed = parse_cobertura_xml(content)
                    if parsed is not None:
                        coverage_status = 'REPORT_AVAILABLE'
                        coverage_pct = parsed
                        coverage_file = cand_name
                        break
                elif cand_name == 'coverage-summary.json':
                    parsed = parse_istanbul_summary_json(content)
                    if parsed is not None:
                        coverage_status = 'REPORT_AVAILABLE'
                        coverage_pct = parsed
                        coverage_file = cand_name
                        break
                elif cand_name == 'lcov.info':
                    parsed = parse_lcov_info(content)
                    if parsed is not None:
                        coverage_status = 'REPORT_AVAILABLE'
                        coverage_pct = parsed
                        coverage_file = cand_name
                        break
            except Exception as e:
                logger.debug("Error reading coverage artifact %s: %s", cand_name, e)

    if coverage_status == 'UNAVAILABLE':
        coverage_details = {
            'reason': 'No coverage artifact (coverage.xml, lcov.info, coverage-summary.json) found in repository root.',
            'recommendation': 'Run pytest --cov or npm test -- --coverage and commit or upload report artifact.',
        }
    else:
        coverage_details = {
            'report_file': coverage_file,
            'metric': 'Line coverage percentage',
        }

    return TestingReport(
        test_files_count=len(test_files),
        test_files=test_files,
        total_source_files=source_files_count,
        test_to_code_ratio=test_to_code_ratio,
        test_configs_detected=configs_detected,
        coverage_status=coverage_status,
        coverage_percentage=coverage_pct,
        coverage_source_file=coverage_file,
        coverage_details=coverage_details,
    )
