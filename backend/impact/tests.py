"""
Test Suite for Phase 4 Impact Analysis.

Covers:
- Path traversal prevention & security checks
- Python & JS/TS import resolution
- Graph direction (forward dependency vs reverse dependent traversal)
- Direct, transitive, and circular dependency handling
- Explainable risk calculation
- Cache invalidation
- Repository isolation and ownership enforcement
- API endpoints (files list & impact analysis)
"""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from repositories.models import Repository
from .resolver import (
    validate_safe_path,
    resolve_python_import,
    resolve_js_ts_import,
    SecurityException,
)
from .parser import parse_python_file, parse_jsts_file
from .graph import (
    build_dependency_graph,
    get_repository_revision,
    RepositoryDependencyGraph,
)
from .analyzer import analyze_file_impact


class ImpactResolverTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.base_dir = Path(self.temp_dir)

        # Create sample repo layout
        (self.base_dir / 'api').mkdir()
        (self.base_dir / 'api' / 'models.py').write_text("class User: pass\n")
        (self.base_dir / 'api' / 'views.py').write_text("from .models import User\n")

        (self.base_dir / 'frontend').mkdir()
        (self.base_dir / 'frontend' / 'Button.tsx').write_text("export const Button = () => null;\n")
        (self.base_dir / 'frontend' / 'App.tsx').write_text("import { Button } from './Button';\n")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_validate_safe_path_valid(self):
        path = validate_safe_path(self.base_dir, 'api/models.py')
        self.assertEqual(path, (self.base_dir / 'api' / 'models.py').resolve())

    def test_validate_safe_path_traversal(self):
        with self.assertRaises(SecurityException):
            validate_safe_path(self.base_dir, '../outside.py')

        with self.assertRaises(SecurityException):
            validate_safe_path(self.base_dir, 'api/../../outside.py')

    def test_validate_safe_path_null_byte(self):
        with self.assertRaises(SecurityException):
            validate_safe_path(self.base_dir, 'api/models.py\x00.exe')

    def test_validate_safe_path_nonexistent(self):
        with self.assertRaises(FileNotFoundError):
            validate_safe_path(self.base_dir, 'api/ghost.py')

    def test_resolve_python_relative_import(self):
        all_files = {'api/models.py', 'api/views.py'}
        resolved = resolve_python_import(
            module_name='models',
            importing_file_rel='api/views.py',
            base_dir=self.base_dir,
            level=1,
            all_repo_files=all_files,
        )
        self.assertEqual(resolved, 'api/models.py')

    def test_resolve_python_external_package(self):
        all_files = {'api/models.py', 'api/views.py'}
        resolved = resolve_python_import(
            module_name='django.db',
            importing_file_rel='api/models.py',
            base_dir=self.base_dir,
            level=0,
            all_repo_files=all_files,
        )
        self.assertIsNone(resolved)

    def test_resolve_js_ts_relative_import(self):
        all_files = {'frontend/Button.tsx', 'frontend/App.tsx'}
        resolved = resolve_js_ts_import(
            import_path='./Button',
            importing_file_rel='frontend/App.tsx',
            base_dir=self.base_dir,
            all_repo_files=all_files,
        )
        self.assertEqual(resolved, 'frontend/Button.tsx')

    def test_resolve_js_ts_external_package(self):
        all_files = {'frontend/App.tsx'}
        resolved = resolve_js_ts_import(
            import_path='react',
            importing_file_rel='frontend/App.tsx',
            base_dir=self.base_dir,
            all_repo_files=all_files,
        )
        self.assertIsNone(resolved)


class ImpactParserTests(TestCase):
    def test_parse_python_file(self):
        code = (
            "from .models import User, Order\n"
            "import os\n\n"
            "def handle_order():\n"
            "    u = User()\n"
            "    return u\n"
        )
        res = parse_python_file('api/views.py', code)
        self.assertTrue(res.syntax_valid)
        self.assertIn('handle_order', res.defined_symbols)
        self.assertIn('User', res.referenced_symbols)
        self.assertEqual(len(res.raw_imports), 2)

    def test_parse_python_syntax_error(self):
        code = "def bad_syntax(:"
        res = parse_python_file('api/bad.py', code)
        self.assertFalse(res.syntax_valid)
        self.assertTrue(len(res.error_message) > 0)

    def test_parse_jsts_file(self):
        code = (
            "import React from 'react';\n"
            "import { UserCard } from './UserCard';\n"
            "export const Profile = () => { return <UserCard />; };\n"
        )
        res = parse_jsts_file('src/Profile.tsx', code)
        self.assertTrue(res.syntax_valid)
        self.assertIn('Profile', res.defined_symbols)
        self.assertTrue(any(i.source_module == './UserCard' for i in res.raw_imports))


class ImpactGraphAndAnalyzerTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.base_dir = Path(self.temp_dir)

        # Create multi-tiered dependency chain:
        # C -> B -> A (C imports B, B imports A)
        # Therefore, if A changes:
        # Direct dependent: B
        # Transitive dependent: C (depth 2, path A -> B -> C)
        (self.base_dir / 'models.py').write_text("class Entity: pass\n")
        (self.base_dir / 'views.py').write_text("from .models import Entity\ndef get_entity(): pass\n")
        (self.base_dir / 'urls.py').write_text("from .views import get_entity\nurlpatterns = []\n")
        (self.base_dir / 'isolated.py').write_text("print('lone module')\n")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_graph_direction_and_reverse_traversal(self):
        graph = build_dependency_graph(repo_id=1, repo_dir=self.base_dir, force_rebuild=True)

        # Forward check: views.py depends on models.py
        fwd_targets = [e.target_file for e in graph.forward_graph.get('views.py', [])]
        self.assertIn('models.py', fwd_targets)

        # Reverse check: models.py is depended on by views.py
        rev_dependents = [e.dependent_file for e in graph.reverse_graph.get('models.py', [])]
        self.assertIn('views.py', rev_dependents)

        # Impact analysis on models.py
        impact = analyze_file_impact(graph, 'models.py')

        # Direct dependent: views.py
        direct_files = [d['file_path'] for d in impact['direct_dependents']]
        self.assertIn('views.py', direct_files)

        # Transitive dependent: urls.py at depth 2
        trans_files = [t['file_path'] for t in impact['transitive_dependents']]
        self.assertIn('urls.py', trans_files)
        trans_url = next(t for t in impact['transitive_dependents'] if t['file_path'] == 'urls.py')
        self.assertEqual(trans_url['depth'], 2)
        self.assertEqual(trans_url['dependency_path'], ['models.py', 'views.py', 'urls.py'])

    def test_circular_dependency_handling(self):
        # Create circular dependency: A -> B -> A
        (self.base_dir / 'circle_a.py').write_text("from .circle_b import b_fn\ndef a_fn(): pass\n")
        (self.base_dir / 'circle_b.py').write_text("from .circle_a import a_fn\ndef b_fn(): pass\n")

        graph = build_dependency_graph(repo_id=1, repo_dir=self.base_dir, force_rebuild=True)
        # Must not hang or crash on recursion
        impact = analyze_file_impact(graph, 'circle_a.py')
        self.assertIsNotNone(impact)
        self.assertTrue(len(impact['cycles_detected']) > 0)

    def test_risk_calculation_factors(self):
        graph = build_dependency_graph(repo_id=1, repo_dir=self.base_dir, force_rebuild=True)

        # models.py has 2 dependents across depth 2
        impact_models = analyze_file_impact(graph, 'models.py')
        self.assertIn(impact_models['risk_assessment']['level'], ['LOW', 'MEDIUM', 'HIGH'])
        self.assertTrue(len(impact_models['risk_assessment']['reasons']) > 0)
        self.assertTrue(impact_models['risk_assessment']['factors']['direct_dependent_count'] >= 1)

        # isolated.py has 0 dependents -> LOW risk
        impact_isolated = analyze_file_impact(graph, 'isolated.py')
        self.assertEqual(impact_isolated['risk_assessment']['level'], 'LOW')
        self.assertEqual(impact_isolated['summary']['total_affected_files'], 0)


class ImpactApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password123')
        self.user2 = User.objects.create_user(username='user2', password='password123')

        self.repo = Repository.objects.create(
            user=self.user1,
            url='https://github.com/user1/test-repo',
            owner='user1',
            name='test-repo',
            status=Repository.Status.SUCCESS,
        )

        # Create actual cloned folder for this test repo
        from django.conf import settings
        self.repo_dir = settings.CLONED_REPOS_DIR / f"{self.repo.owner}_{self.repo.name}_{self.repo.id}"
        self.repo_dir.mkdir(parents=True, exist_ok=True)

        (self.repo_dir / 'service.py').write_text("def run(): pass\n")
        (self.repo_dir / 'main.py').write_text("from .service import run\nrun()\n")

    def tearDown(self):
        if self.repo_dir.exists():
            shutil.rmtree(self.repo_dir, ignore_errors=True)

    def test_unauthenticated_request_rejected(self):
        res = self.client.get(f'/api/repositories/{self.repo.id}/impact/files/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_repository_isolation_enforced(self):
        # User 2 should NOT be able to access User 1's repository impact
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f'/api/repositories/{self.repo.id}/impact/files/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        res_post = self.client.post(
            f'/api/repositories/{self.repo.id}/impact/',
            {'file_path': 'service.py'},
            format='json',
        )
        self.assertEqual(res_post.status_code, status.HTTP_404_NOT_FOUND)

    def test_path_traversal_rejected(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(
            f'/api/repositories/{self.repo.id}/impact/',
            {'file_path': '../../etc/passwd'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Security violation', res.data['error'])

    def test_impact_files_endpoint_success(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/repositories/{self.repo.id}/impact/files/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('service.py', res.data['files'])
        self.assertIn('main.py', res.data['files'])

    def test_impact_analysis_endpoint_success(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(
            f'/api/repositories/{self.repo.id}/impact/',
            {'file_path': 'service.py'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['target_file'], 'service.py')
        self.assertEqual(res.data['summary']['direct_dependent_count'], 1)
        self.assertEqual(res.data['direct_dependents'][0]['file_path'], 'main.py')
        self.assertIn('risk_assessment', res.data)
        self.assertIn('ai_advisory', res.data)

    def test_cache_invalidation_on_repo_change(self):
        self.client.force_authenticate(user=self.user1)

        # 1. First build creates cache
        g1 = build_dependency_graph(repo_id=self.repo.id, repo_dir=self.repo_dir)
        cache_file = self.repo_dir / '.repomind_impact_cache.json'
        self.assertTrue(cache_file.exists())
        self.assertEqual(len(g1.all_files), 2)

        # 2. Add a new file
        (self.repo_dir / 'extra.py').write_text("from .service import run\n")

        # 3. Next build must detect fingerprint change and include extra.py
        g2 = build_dependency_graph(repo_id=self.repo.id, repo_dir=self.repo_dir)
        self.assertIn('extra.py', g2.all_files)
        # service.py should now have 2 direct dependents: main.py and extra.py
        dependents = [e.dependent_file for e in g2.reverse_graph.get('service.py', [])]
        self.assertIn('extra.py', dependents)
        self.assertIn('main.py', dependents)

    @patch('impact.advisory._get_gemini_client')
    def test_ai_advisory_when_gemini_available(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Modifying service.py may impact runner workflows in main.py."
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = (mock_client, 'gemini-2.5-flash')

        from .advisory import generate_ai_advisory
        data = {
            'target_file': 'service.py',
            'summary': {'direct_dependent_count': 1, 'transitive_dependent_count': 0, 'max_depth': 1},
            'risk_assessment': {'level': 'LOW', 'score': 20, 'reasons': ['1 direct dependent']},
            'direct_dependents': [{'file_path': 'main.py'}],
        }
        res = generate_ai_advisory(data)
        self.assertTrue(res['available'])
        self.assertIn("Modifying service.py", res['insight'])
        self.assertIn("disclaimer", res)

    @patch('impact.advisory._get_gemini_client')
    def test_ai_advisory_graceful_fallback_when_gemini_fails(self, mock_get_client):
        mock_get_client.side_effect = Exception("API rate limited")

        from .advisory import generate_ai_advisory
        data = {'target_file': 'service.py'}
        res = generate_ai_advisory(data)
        self.assertFalse(res['available'])
        self.assertIsNone(res['insight'])
        self.assertIn("disclaimer", res)
