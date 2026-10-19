"""
Tests for Productivity Analytics Engine (Phase 6).
"""

from datetime import datetime, timedelta, timezone
from django.contrib.auth.models import User
from django.test import TestCase

from memory.models import CommitMemory
from repositories.models import Repository
from productivity.services.analytics import (
    calculate_productivity_analytics,
    resolve_time_bounds,
    compute_previous_period_bounds,
    mask_email,
    extract_module_path,
)


class ProductivityAnalyticsServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='password123')
        self.repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/alice/test-repo',
            owner='alice',
            name='test-repo',
            status=Repository.Status.SUCCESS,
        )

        self.ref_now = datetime.now(timezone.utc)

        # Create a series of CommitMemory records
        # Commit 1: 25 days ago
        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='sha0011111111111111111111111111111111111',
            author_name='Alice Smith',
            author_email='alice@example.com',
            committed_date=self.ref_now - timedelta(days=25),
            message='Initial commit with auth scaffolding',
            files_changed=[
                {'filename': 'auth/login.py', 'status': 'added', 'additions': 100, 'deletions': 0},
                {'filename': 'README.md', 'status': 'added', 'additions': 20, 'deletions': 0},
            ],
            stats={'total_additions': 120, 'total_deletions': 0, 'files_changed_count': 2},
        )

        # Commit 2: 15 days ago (same author)
        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='sha0022222222222222222222222222222222222',
            author_name='Alice Smith',
            author_email='alice@example.com',
            committed_date=self.ref_now - timedelta(days=15),
            message='Refactor auth logic and add logout',
            files_changed=[
                {'filename': 'auth/login.py', 'status': 'modified', 'additions': 30, 'deletions': 10},
                {'filename': 'auth/logout.py', 'status': 'added', 'additions': 40, 'deletions': 0},
            ],
            stats={'total_additions': 70, 'total_deletions': 10, 'files_changed_count': 2},
        )

        # Commit 3: 5 days ago (different author Bob)
        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='sha0033333333333333333333333333333333333',
            author_name='Bob Jones',
            author_email='bob@company.com',
            committed_date=self.ref_now - timedelta(days=5),
            message='Fix typo in auth and update readme',
            files_changed=[
                {'filename': 'auth/login.py', 'status': 'modified', 'additions': 5, 'deletions': 5},
                {'filename': 'README.md', 'status': 'modified', 'additions': 10, 'deletions': 2},
            ],
            stats={'total_additions': 15, 'total_deletions': 7, 'files_changed_count': 2},
        )

        # Commit 4: 45 days ago (in the previous 30-day window!)
        CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='sha0044444444444444444444444444444444444',
            author_name='Alice Smith',
            author_email='alice@example.com',
            committed_date=self.ref_now - timedelta(days=45),
            message='Pre-alpha prototype',
            files_changed=[
                {'filename': 'prototype.py', 'status': 'added', 'additions': 50, 'deletions': 0},
            ],
            stats={'total_additions': 50, 'total_deletions': 0, 'files_changed_count': 1},
        )

    def test_mask_email(self):
        self.assertEqual(mask_email('alice@example.com'), 'a***e@example.com')
        self.assertEqual(mask_email('bo@company.com'), 'b*@company.com')
        self.assertEqual(mask_email(''), '')

    def test_extract_module_path(self):
        self.assertEqual(extract_module_path('README.md'), '(root)')
        self.assertEqual(extract_module_path('auth/login.py'), 'auth')
        self.assertEqual(extract_module_path('src/components/button/index.tsx'), 'src/components')

    def test_resolve_time_bounds(self):
        start_7d, end_7d, label_7d = resolve_time_bounds('7d', reference_time=self.ref_now)
        self.assertEqual(label_7d, '7d')
        self.assertEqual(end_7d - start_7d, timedelta(days=7))

        start_30d, end_30d, label_30d = resolve_time_bounds('30d', reference_time=self.ref_now)
        self.assertEqual(label_30d, '30d')
        self.assertEqual(end_30d - start_30d, timedelta(days=30))

        start_custom, end_custom, label_custom = resolve_time_bounds(
            'custom',
            start_date_str='2026-08-01',
            end_date_str='2026-08-15',
            reference_time=self.ref_now,
        )
        self.assertEqual(label_custom, 'custom')
        self.assertEqual(start_custom.year, 2026)
        self.assertEqual(start_custom.month, 8)
        self.assertEqual(start_custom.day, 1)

    def test_calculate_productivity_analytics_30d(self):
        res = calculate_productivity_analytics(
            repository=self.repo,
            time_range='30d',
            aggregation='daily',
        )

        ov = res['overview']
        # In last 30 days: commit 1 (25d ago), commit 2 (15d ago), commit 3 (5d ago) = 3 commits
        self.assertEqual(ov['total_commits'], 3)
        self.assertEqual(ov['active_contributors'], 2)  # Alice & Bob
        self.assertEqual(ov['files_modified'], 3)       # auth/login.py, auth/logout.py, README.md

        # Additions: 120 + 70 + 15 = 205
        # Deletions: 0 + 10 + 7 = 17
        self.assertEqual(ov['lines_added'], 205)
        self.assertEqual(ov['lines_deleted'], 17)
        self.assertEqual(ov['net_line_change'], 188)
        self.assertEqual(ov['total_churn_volume'], 222)
        self.assertTrue(ov['stats_available'])

        # Previous period comparison: commit 4 (45d ago) is in [now-60d, now-30d]
        prev = ov['previous_period']
        self.assertTrue(prev['has_previous_data'])
        self.assertEqual(prev['previous_commits'], 1)
        self.assertEqual(prev['previous_additions'], 50)
        # 1 commit in prev vs 3 in curr => +200%
        self.assertEqual(prev['commits_delta_pct'], 200.0)

    def test_file_hotspots(self):
        res = calculate_productivity_analytics(
            repository=self.repo,
            time_range='30d',
        )
        hotspots = res['hotspots']
        self.assertTrue(len(hotspots) >= 2)

        # auth/login.py was touched in all 3 commits
        login_hotspot = next(h for h in hotspots if h['file_path'] == 'auth/login.py')
        self.assertEqual(login_hotspot['commit_count'], 3)
        self.assertEqual(login_hotspot['contributor_count'], 2)
        self.assertEqual(login_hotspot['lines_added'], 135)
        self.assertEqual(login_hotspot['lines_deleted'], 15)
        self.assertEqual(login_hotspot['total_churn'], 150)
        self.assertIn(login_hotspot['activity_label'], [
            "Frequently modified", "High code churn", "Multiple contributors", "Repeatedly changed", "Recently active"
        ])

    def test_module_analytics(self):
        res = calculate_productivity_analytics(
            repository=self.repo,
            time_range='30d',
        )
        modules = res['modules']
        auth_mod = next((m for m in modules if m['module_path'] == 'auth'), None)
        self.assertIsNotNone(auth_mod)
        self.assertEqual(auth_mod['commit_count'], 3)
        self.assertEqual(auth_mod['file_count'], 2)  # login.py & logout.py
        self.assertEqual(auth_mod['contributor_count'], 2)
        self.assertFalse(auth_mod['single_contributor_period'])

    def test_empty_repository(self):
        empty_repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/alice/empty-repo',
            owner='alice',
            name='empty-repo',
            status=Repository.Status.SUCCESS,
        )

        res = calculate_productivity_analytics(empty_repo, time_range='30d')
        self.assertEqual(res['overview']['total_commits'], 0)
        self.assertEqual(res['overview']['active_contributors'], 0)
        self.assertEqual(res['timeline'], [])
        self.assertEqual(res['contributors'], [])
        self.assertEqual(res['hotspots'], [])
        self.assertEqual(res['modules'], [])
        self.assertFalse(res['overview']['stats_available'])
