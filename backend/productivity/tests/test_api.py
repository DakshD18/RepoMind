"""
Tests for Productivity API Endpoints (Phase 6).
"""

from datetime import datetime, timedelta, timezone
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from memory.models import CommitMemory
from repositories.models import Repository


class ProductivityAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(username='alice', password='password123')
        self.bob = User.objects.create_user(username='bob', password='password123')

        self.repo = Repository.objects.create(
            user=self.alice,
            url='https://github.com/alice/test-repo',
            owner='alice',
            name='test-repo',
            status=Repository.Status.SUCCESS,
        )

        # Ingest test commits for Alice's repo
        now = datetime.now(timezone.utc)
        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='c111111111111111111111111111111111111111',
            author_name='Alice Smith',
            author_email='alice@example.com',
            committed_date=now - timedelta(days=2),
            message='Add user profile',
            files_changed=[
                {'filename': 'users/profile.py', 'status': 'added', 'additions': 80, 'deletions': 0},
            ],
            stats={'total_additions': 80, 'total_deletions': 0, 'files_changed_count': 1},
        )

        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='c222222222222222222222222222222222222222',
            author_name='Dev Contributor',
            author_email='dev@example.com',
            committed_date=now - timedelta(days=1),
            message='Update README',
            files_changed=[
                {'filename': 'README.md', 'status': 'modified', 'additions': 10, 'deletions': 2},
            ],
            stats={'total_additions': 10, 'total_deletions': 2, 'files_changed_count': 1},
        )

    def test_unauthenticated_request_rejected(self):
        url = f'/api/repositories/{self.repo.id}/productivity/'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_user_isolation(self):
        """User Bob must not be able to access Alice's repository productivity analytics."""
        self.client.force_authenticate(user=self.bob)
        url = f'/api/repositories/{self.repo.id}/productivity/'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_overview_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/?range=30d'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['repository_id'], self.repo.id)
        self.assertEqual(data['overview']['total_commits'], 2)
        self.assertEqual(data['overview']['active_contributors'], 2)
        self.assertEqual(data['overview']['files_modified'], 2)
        self.assertEqual(data['overview']['lines_added'], 90)
        self.assertEqual(data['overview']['lines_deleted'], 2)
        self.assertEqual(data['overview']['net_line_change'], 88)
        self.assertEqual(data['overview']['total_churn_volume'], 92)

    def test_activity_timeline_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/activity/?range=7d&aggregation=daily'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('timeline', data)
        self.assertTrue(len(data['timeline']) >= 7)  # Continuous daily buckets for 7 days

    def test_contributors_endpoint_with_search(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/contributors/?search=Alice'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['display_name'], 'Alice Smith')

    def test_hotspots_endpoint_and_single_file_detail(self):
        self.client.force_authenticate(user=self.alice)

        # 1. Hotspots list
        list_url = f'/api/repositories/{self.repo.id}/productivity/hotspots/?ordering=-commits'
        resp = self.client.get(list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['count'], 2)

        # 2. Single file drill-down
        detail_url = f'/api/repositories/{self.repo.id}/productivity/hotspots/?file_path=users/profile.py'
        resp_detail = self.client.get(detail_url)
        self.assertEqual(resp_detail.status_code, status.HTTP_200_OK)
        detail_data = resp_detail.json()
        self.assertEqual(detail_data['file_path'], 'users/profile.py')
        self.assertEqual(detail_data['commit_touches_count'], 1)
        self.assertEqual(len(detail_data['commits']), 1)
        self.assertIn('/impact', detail_data['impact_analysis_url'])

    def test_modules_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/modules/'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('modules', data)
        modules = data['modules']
        mod_names = [m['module_path'] for m in modules]
        self.assertIn('users', mod_names)
        self.assertIn('(root)', mod_names)

    def test_churn_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/churn/?range=30d'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        churn = data['churn']
        self.assertEqual(churn['total_additions'], 90)
        self.assertEqual(churn['total_deletions'], 2)
        self.assertEqual(churn['net_line_change'], 88)
        self.assertEqual(churn['total_churn_volume'], 92)

    def test_insights_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/insights/?range=30d'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('overall_pattern', data)
        self.assertIn('areas_for_review', data)
        self.assertIn('data_limitations', data)

    def test_refresh_endpoint(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/refresh/'
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['repository_id'], self.repo.id)
        self.assertIn('total_commits_in_memory', data)

    def test_invalid_parameters_handled_gracefully(self):
        self.client.force_authenticate(user=self.alice)
        url = f'/api/repositories/{self.repo.id}/productivity/?range=invalid_range_value'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
