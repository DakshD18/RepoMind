"""
Unit tests for deterministic health analyzers (Complexity, Duplication, Testing, Documentation, Scoring).
"""

import tempfile
import shutil
from pathlib import Path
from django.test import SimpleTestCase

from health.services.complexity import (
    analyze_python_complexity,
    analyze_jsts_complexity,
    analyze_file_complexity,
)
from health.services.duplication import detect_code_duplication
from health.services.testing import (
    is_test_file,
    parse_cobertura_xml,
    parse_istanbul_summary_json,
    parse_lcov_info,
    analyze_repository_testing,
)
from health.services.documentation import (
    analyze_python_documentation,
    analyze_repository_documentation,
)
from health.services.scoring import (
    compute_overall_health_score,
    get_letter_grade,
    calculate_complexity_score,
    calculate_duplication_score,
    calculate_testing_score,
)


class ComplexityAnalyzerTests(SimpleTestCase):
    def test_python_cyclomatic_complexity(self):
        code = """
def sample_function(x, y):
    # Base complexity = 1
    if x > 0:  # +1
        for i in range(x):  # +1
            if y and x:  # +1 (if) + 1 (and)
                print(i)
    elif y > 0:  # +1
        while y > 0:  # +1
            y -= 1
    try:
        pass
    except ValueError:  # +1
        pass
    return x if y else 0  # +1
"""
        res = analyze_python_complexity("sample.py", code)
        self.assertTrue(res.syntax_valid)
        self.assertEqual(len(res.functions), 1)
        fn = res.functions[0]
        self.assertEqual(fn.name, "sample_function")
        # 1 base + 1 (if) + 1 (for) + 2 (if + and) + 1 (elif) + 1 (while) + 1 (except) + 1 (ifexp) = 9
        self.assertEqual(fn.complexity, 9)
        self.assertEqual(res.max_complexity, 9)

    def test_python_class_methods_and_nesting(self):
        code = """
class DataProcessor:
    def process(self, items):
        if not items:
            return []
        return [x for x in items if x > 0]
"""
        res = analyze_python_complexity("processor.py", code)
        self.assertTrue(res.syntax_valid)
        self.assertEqual(len(res.functions), 1)
        fn = res.functions[0]
        self.assertEqual(fn.qualified_name, "DataProcessor.process")
        # 1 base + 1 (if) + 1 (comprehension for) + 1 (comprehension if) = 4
        self.assertEqual(fn.complexity, 4)

    def test_typescript_cyclomatic_complexity(self):
        ts_code = """
function calculateDiscount(price: number, isVip: boolean): number {
    if (price <= 0) {
        return 0;
    }
    if (isVip && price > 100) {
        return price * 0.8;
    }
    return price;
}
"""
        res = analyze_jsts_complexity("discount.ts", ts_code, ".ts")
        if res.ast_supported:
            self.assertEqual(len(res.functions), 1)
            fn = res.functions[0]
            self.assertEqual(fn.name, "calculateDiscount")
            # 1 base + 1 (if) + 2 (if + &&) = 4
            self.assertGreaterEqual(fn.complexity, 3)

    def test_unsupported_language_fallback(self):
        txt_code = "line 1\nline 2\nline 3\n"
        res = analyze_file_complexity("notes.txt", txt_code)
        self.assertFalse(res.ast_supported)
        self.assertEqual(res.physical_loc, 3)
        self.assertEqual(res.max_complexity, 1)


class DuplicationDetectorTests(SimpleTestCase):
    def test_identical_blocks_detected(self):
        code_a = """
def authenticate_user(username, password):
    cleaned_user = username.strip().lower()
    hashed_pw = hash_password(password)
    user_record = db.query(cleaned_user)
    if not user_record:
        return None
    token = generate_jwt_token(user_record)
    return token
"""
        code_b = """
def authenticate_admin(username, password):
    cleaned_user = username.strip().lower()
    hashed_pw = hash_password(password)
    user_record = db.query(cleaned_user)
    if not user_record:
        return None
    token = generate_jwt_token(user_record)
    return token
"""
        report = detect_code_duplication({
            'auth.py': code_a,
            'admin.py': code_b,
        }, min_lines=5)

        self.assertGreater(report.duplication_percentage, 0.0)
        self.assertGreaterEqual(len(report.duplicate_blocks), 1)
        blk = report.duplicate_blocks[0]
        self.assertIn('auth.py', [blk.file_a, blk.file_b])
        self.assertIn('admin.py', [blk.file_a, blk.file_b])

    def test_different_code_has_zero_duplication(self):
        report = detect_code_duplication({
            'a.py': 'def foo():\n    return 1\n    return 2\n',
            'b.py': 'def bar():\n    return "x"\n    return "y"\n',
        }, min_lines=5)
        self.assertEqual(report.duplication_percentage, 0.0)
        self.assertEqual(len(report.duplicate_blocks), 0)


class TestingAnalyzerTests(SimpleTestCase):
    def test_is_test_file_patterns(self):
        self.assertTrue(is_test_file("backend/tests/test_api.py"))
        self.assertTrue(is_test_file("tests.py"))
        self.assertTrue(is_test_file("frontend/src/Button.test.tsx"))
        self.assertTrue(is_test_file("frontend/src/Button.spec.js"))
        self.assertFalse(is_test_file("backend/views.py"))
        self.assertFalse(is_test_file("frontend/src/Button.tsx"))

    def test_parse_cobertura_xml(self):
        xml_content = '<?xml version="1.0" ?><coverage line-rate="0.845" branch-rate="0.75"></coverage>'
        rate = parse_cobertura_xml(xml_content)
        self.assertEqual(rate, 84.5)

    def test_parse_istanbul_json(self):
        json_content = '{"total": {"lines": {"total": 100, "covered": 78, "pct": 78.0}}}'
        rate = parse_istanbul_summary_json(json_content)
        self.assertEqual(rate, 78.0)

    def test_zero_fabrication_rule(self):
        temp_dir = Path(tempfile.mkdtemp())
        try:
            (temp_dir / "views.py").write_text("class View: pass")
            report = analyze_repository_testing(temp_dir, ["views.py"])
            self.assertEqual(report.coverage_status, "UNAVAILABLE")
            self.assertIsNone(report.coverage_percentage)
            self.assertEqual(report.test_files_count, 0)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class DocumentationAnalyzerTests(SimpleTestCase):
    def test_python_docstrings_detection(self):
        code = """
'''Module documentation.'''

class MyService:
    '''Class docstring.'''
    def documented_method(self):
        '''Method docstring.'''
        pass

    def undocumented_method(self):
        pass

    def _private_method(self):
        # Private methods shouldn't count against public doc ratio
        pass
"""
        info = analyze_python_documentation("service.py", code)
        self.assertTrue(info.has_module_docstring)
        # 1 class + 2 public methods = 3 public symbols
        self.assertEqual(info.total_public_symbols, 3)
        # Class + documented_method = 2 documented
        self.assertEqual(info.documented_public_symbols, 2)
        self.assertEqual(info.docstring_ratio, 0.67)


class ScoringEngineTests(SimpleTestCase):
    def test_score_and_grade_boundaries(self):
        self.assertEqual(get_letter_grade(95.0), 'A+')
        self.assertEqual(get_letter_grade(85.0), 'A')
        self.assertEqual(get_letter_grade(75.0), 'B')
        self.assertEqual(get_letter_grade(65.0), 'C')
        self.assertEqual(get_letter_grade(55.0), 'D')
        self.assertEqual(get_letter_grade(45.0), 'F')

    def test_composite_scoring_calculation(self):
        res = compute_overall_health_score(
            complexity_input={'total_functions': 10, 'complex_functions_count': 0, 'severe_functions_count': 0, 'avg_complexity': 2.0},
            maintainability_input={'total_files': 10, 'large_files_count': 0, 'oversized_files_count': 0},
            duplication_input={'duplication_percentage': 0.0},
            testing_input={'test_files_count': 4, 'test_to_code_ratio': 0.28, 'coverage_status': 'REPORT_AVAILABLE', 'coverage_percentage': 88.0},
            documentation_input={'has_readme': True, 'documented_symbols_ratio': 0.90, 'total_public_symbols': 20},
            dependencies_input={'circular_cycles_count': 0, 'syntax_errors_count': 0, 'unresolved_imports_count': 0},
        )
        self.assertGreaterEqual(res.overall_score, 90.0)
        self.assertEqual(res.grade, 'A+')
        self.assertIn('complexity', res.component_scores)
        self.assertEqual(res.component_scores['complexity'], 100.0)
