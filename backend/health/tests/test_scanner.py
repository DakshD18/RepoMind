"""
Integration and model tests for Scanner Orchestration, Snapshots, and Findings.
"""

import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth.models import User
from repositories.models import Repository

from health.models import RepositoryHealthSnapshot, HealthFinding
from health.services.scanner import run_health_scan, _generate_finding_fingerprint


class ScannerOrchestrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='password')
        self.repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/tester/repo',
            name='repo',
            owner='tester',
        )

        self.temp_dir = tempfile.mkdtemp()
        self.repo_dir = Path(self.temp_dir)

        # Create basic repository file tree
        (self.repo_dir / 'api').mkdir()
        (self.repo_dir / 'api' / 'models.py').write_text(
            "'''Model definitions.'''\nclass User:\n    '''User model.'''\n    pass\n"
        )
        (self.repo_dir / 'api' / 'views.py').write_text(
            "from .models import User\n\ndef get_user(request, user_id):\n    if user_id > 0:\n        return User()\n    return None\n"
        )
        (self.repo_dir / 'api' / 'tests.py').write_text(
            "def test_user():\n    assert True\n"
        )
        (self.repo_dir / 'README.md').write_text(
            "# Repo Title\n\nThis is a descriptive readme that exceeds the 200 character minimum requirement for healthy documentation. It provides setup instructions and an architecture overview for team members.\n"
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @patch('health.services.scanner.get_repository_revision', return_value='abc1234567890')
    def test_run_health_scan_creates_snapshot_and_findings(self, mock_rev):
        snapshot, delta = run_health_scan(self.repo, self.repo_dir, force_rescan=True)

        self.assertIsNotNone(snapshot.id)
        self.assertEqual(snapshot.repository, self.repo)
        self.assertEqual(snapshot.commit_sha, 'abc1234567890')
        self.assertGreater(snapshot.overall_score, 0.0)
        self.assertIn(snapshot.grade, ['A+', 'A', 'B', 'C', 'D', 'F'])
        self.assertIn('complexity', snapshot.component_scores)
        self.assertIn('maintainability', snapshot.component_scores)
        self.assertIn('duplication', snapshot.component_scores)
        self.assertIn('testing', snapshot.component_scores)

        # Findings created in DB
        findings = HealthFinding.objects.filter(snapshot=snapshot)
        for f in findings:
            self.assertEqual(f.repository, self.repo)
            self.assertTrue(bool(f.fingerprint))

    @patch('health.services.scanner.get_repository_revision', return_value='abc1234567890')
    def test_snapshot_caching_and_force_rescan(self, mock_rev):
        snap1, delta1 = run_health_scan(self.repo, self.repo_dir, force_rescan=True)
        self.assertFalse(delta1.get('cached', False))

        # Subsequent call without force_rescan should reuse cached snapshot
        snap2, delta2 = run_health_scan(self.repo, self.repo_dir, force_rescan=False)
        self.assertEqual(snap1.id, snap2.id)
        self.assertTrue(delta2.get('cached', False))

        # With force_rescan=True, should create a new snapshot
        snap3, delta3 = run_health_scan(self.repo, self.repo_dir, force_rescan=True)
        self.assertNotEqual(snap1.id, snap3.id)
        self.assertFalse(delta3.get('cached', False))

    def test_finding_fingerprint_stability(self):
        fp1 = _generate_finding_fingerprint(
            category="COMPLEXITY",
            finding_type="SEVERE_CYCLOMATIC_COMPLEXITY",
            file_path="api/views.py",
            symbol_name="get_user"
        )
        fp2 = _generate_finding_fingerprint(
            category="COMPLEXITY",
            finding_type="SEVERE_CYCLOMATIC_COMPLEXITY",
            file_path="api/views.py",
            symbol_name="get_user"
        )
        self.assertEqual(fp1, fp2)
