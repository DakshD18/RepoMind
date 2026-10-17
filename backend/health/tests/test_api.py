"""
API and Security Tests for Health Dashboard Endpoints (Phase 5).
"""

import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from repositories.models import Repository

from health.models import RepositoryHealthSnapshot, HealthFinding


class HealthAPITests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='user_a', password='password123')
        self.user_b = User.objects.create_user(username='user_b', password='password123')

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

        self.anon_client = APIClient()

        # Repository owned by User A
        self.repo_a = Repository.objects.create(
            user=self.user_a,
            url='https://github.com/user_a/repo_a',
            name='repo_a',
            owner='user_a',
        )

        # Temporary cloned repo filesystem
        self.temp_dir = tempfile.mkdtemp()
        self.repo_dir = Path(self.temp_dir)
        (self.repo_dir / 'api').mkdir()
        (self.repo_dir / 'api' / 'views.py').write_text(
            "'''Views module.'''\ndef view_a():\n    if True:\n        return 1\n    return 0\n"
        )
        (self.repo_dir / 'README.md').write_text(
            "# Title\n\nDescriptive readme that meets the 200 character minimum requirement for healthy documentation. It provides setup instructions and an architecture overview for team members.\n"
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_unauthenticated_access_denied(self):
        res = self.anon_client.get(f'/api/repositories/{self.repo_a.id}/health/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_repository_ownership_isolation(self):
        # User B cannot view User A's repository health data
        res = self.client_b.get(f'/api/repositories/{self.repo_a.id}/health/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # User B cannot trigger scan on User A's repository
        res_scan = self.client_b.post(f'/api/repositories/{self.repo_a.id}/health/scan/', {})
        self.assertEqual(res_scan.status_code, status.HTTP_404_NOT_FOUND)

    def test_health_overview_no_snapshot(self):
        with patch('health.views.settings.CLONED_REPOS_DIR', self.repo_dir.parent):
            with patch('health.views._get_user_repository', return_value=(self.repo_a, self.repo_dir, None)):
                res = self.client_a.get(f'/api/repositories/{self.repo_a.id}/health/')
                self.assertEqual(res.status_code, status.HTTP_200_OK)
                self.assertFalse(res.data['has_snapshot'])
                self.assertEqual(res.data['repository_id'], self.repo_a.id)

    @patch('health.services.scanner.get_repository_revision', return_value='1111222233334444555566667777888899990000')
    def test_health_scan_and_findings_retrieval(self, mock_rev):
        with patch('health.views.settings.CLONED_REPOS_DIR', self.repo_dir.parent):
            with patch('health.views._get_user_repository', return_value=(self.repo_a, self.repo_dir, None)):
                # 1. Trigger scan
                scan_res = self.client_a.post(f'/api/repositories/{self.repo_a.id}/health/scan/', {
                    'force_rescan': True,
                    'generate_ai_summary': False,
                })
                self.assertEqual(scan_res.status_code, status.HTTP_201_CREATED)
                self.assertIn('snapshot', scan_res.data)
                self.assertGreater(scan_res.data['snapshot']['overall_score'], 0.0)

                # 2. Get overview
                over_res = self.client_a.get(f'/api/repositories/{self.repo_a.id}/health/')
                self.assertEqual(over_res.status_code, status.HTTP_200_OK)
                self.assertTrue(over_res.data['has_snapshot'])
                self.assertEqual(over_res.data['latest_snapshot']['commit_sha'], '1111222233334444555566667777888899990000')

                # 3. Get findings
                find_res = self.client_a.get(f'/api/repositories/{self.repo_a.id}/health/findings/')
                self.assertEqual(find_res.status_code, status.HTTP_200_OK)
                self.assertIn('results', find_res.data)

                # 4. Get file health
                files_res = self.client_a.get(f'/api/repositories/{self.repo_a.id}/health/files/')
                self.assertEqual(files_res.status_code, status.HTTP_200_OK)
                self.assertIn('files', files_res.data)
                self.assertGreater(files_res.data['total_files'], 0)

                # 5. Get historical trends
                trends_res = self.client_a.get(f'/api/repositories/{self.repo_a.id}/health/trends/')
                self.assertEqual(trends_res.status_code, status.HTTP_200_OK)
                self.assertEqual(trends_res.data['total_snapshots'], 1)
