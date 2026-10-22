"""
Test Suite for Architecture Intelligence Backend APIs and Services.

Tests:
1. Authentication & Repository Ownership Isolation (cross-user access prevention)
2. Safe Path Validation & Traversal Attack Prevention
3. Architecture Overview API (metrics, languages, component roles, counts)
4. Repository Tree API (hierarchical folders/files, counts, search filtering)
5. Architecture Graph API (nodes, edges, limit bounding, filtering, focus expansion)
6. Component Details API (incoming/outgoing dependencies, symbols, issues, GitHub link)
7. Architecture Findings API (circular dependency detection, unresolved imports)
8. Empty repository handling
"""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from repositories.models import Repository
from embeddings.models import CodeChunk
from .services import (
    get_architecture_overview,
    build_architecture_tree,
    extract_architecture_graph,
    extract_node_detail,
    detect_architecture_findings,
    classify_component_type,
    get_file_language,
)


class ArchitectureServiceAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.user = User.objects.create_user(username='daksh', password='testpassword123')
        self.other_user = User.objects.create_user(username='other_dev', password='testpassword123')

        # Temp directory simulating cloned repo
        self.temp_dir = tempfile.mkdtemp()
        self.repo_dir = Path(self.temp_dir)

        # Repositories
        self.repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/repomind/core-service',
            name='core-service',
            owner='repomind',
            default_branch='main',
            status=Repository.Status.SUCCESS,
        )

        self.other_repo = Repository.objects.create(
            user=self.other_user,
            url='https://github.com/other/secret-service',
            name='secret-service',
            owner='other',
            default_branch='main',
            status=Repository.Status.SUCCESS,
        )

        # Populate sample multi-module repository files
        # Directory structure:
        # core/
        #   __init__.py
        #   models.py
        #   service.py
        # api/
        #   __init__.py
        #   views.py
        # frontend/
        #   App.tsx
        #   Widget.tsx
        # manage.py
        # cycle_a.py
        # cycle_b.py

        (self.repo_dir / 'core').mkdir(parents=True)
        (self.repo_dir / 'api').mkdir(parents=True)
        (self.repo_dir / 'frontend').mkdir(parents=True)

        (self.repo_dir / 'manage.py').write_text("# entry point\nimport os\n")

        (self.repo_dir / 'core' / '__init__.py').write_text("")
        (self.repo_dir / 'core' / 'models.py').write_text(
            "class UserModel:\n    name = 'User'\n\nclass OrgModel:\n    pass\n"
        )
        (self.repo_dir / 'core' / 'service.py').write_text(
            "from .models import UserModel\n\ndef process_user():\n    return UserModel()\n"
        )

        (self.repo_dir / 'api' / '__init__.py').write_text("")
        (self.repo_dir / 'api' / 'views.py').write_text(
            "from core.service import process_user\nfrom core.models import OrgModel\nimport non_existent_pkg\n\ndef user_view():\n    return process_user()\n"
        )

        # Frontend JS/TS
        (self.repo_dir / 'frontend' / 'Widget.tsx').write_text(
            "export const Widget = () => <div>Widget</div>;\n"
        )
        (self.repo_dir / 'frontend' / 'App.tsx').write_text(
            "import { Widget } from './Widget';\nexport default function App() { return <Widget />; }\n"
        )

        # Circular cycle
        (self.repo_dir / 'cycle_a.py').write_text("from cycle_b import b_func\ndef a_func(): pass\n")
        (self.repo_dir / 'cycle_b.py').write_text("from cycle_a import a_func\ndef b_func(): pass\n")

        # Create sample CodeChunk for core/models.py to test AST symbol retrieval
        CodeChunk.objects.create(
            repository=self.repo,
            file_path='core/models.py',
            symbol_name='UserModel',
            symbol_type='class',
            start_line=1,
            end_line=2,
            content="class UserModel:\n    name = 'User'",
        )

        # Authenticate client
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _patch_repo_dir(self):
        """Helper to point _get_user_repository to our temp directory."""
        return patch('architecture.views._get_user_repository', return_value=(self.repo, self.repo_dir, None))

    # ─── 1. Security & Ownership Tests ────────────────────────────────────────

    def test_unauthenticated_access_denied(self):
        """Endpoints must reject unauthenticated requests with 401."""
        self.client.force_authenticate(user=None)
        res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_user_access_prevented(self):
        """User cannot access another user's repository architecture (must 404)."""
        res = self.client.get(f'/api/repositories/{self.other_repo.id}/architecture/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_path_traversal_prevention(self):
        """Path traversal attacks on node detail or focus parameter must return 400."""
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/node/?path=../../etc/passwd')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('traversal', res.data['error'].lower())

            res2 = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/?focus=../outside.py')
            self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # ─── 2. Classification Tests ──────────────────────────────────────────────

    def test_classify_component_type(self):
        self.assertEqual(classify_component_type('manage.py'), 'entry_point')
        self.assertEqual(classify_component_type('vite.config.ts'), 'config')
        self.assertEqual(classify_component_type('tests/test_api.py'), 'test')
        self.assertEqual(classify_component_type('api/views.py'), 'route')
        self.assertEqual(classify_component_type('core/models.py'), 'model')
        self.assertEqual(classify_component_type('core/service.py'), 'service')
        self.assertEqual(classify_component_type('frontend/Widget.tsx'), 'component')

    def test_get_file_language(self):
        self.assertEqual(get_file_language('core/models.py'), 'Python')
        self.assertEqual(get_file_language('frontend/App.tsx'), 'TypeScript React')
        self.assertEqual(get_file_language('frontend/Widget.ts'), 'TypeScript')

    # ─── 3. Overview API Tests ────────────────────────────────────────────────

    def test_architecture_overview_success(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data

            self.assertEqual(data['repo_id'], self.repo.id)
            self.assertEqual(data['default_branch'], 'main')
            self.assertGreater(data['total_files'], 0)
            self.assertGreater(data['total_dependencies'], 0)
            self.assertIn('Python', data['languages'])
            self.assertIn('TypeScript React', data['languages'])
            self.assertIn('model', data['component_types'])
            self.assertIn('service', data['component_types'])
            self.assertGreaterEqual(data['circular_cycles_count'], 1)
            self.assertGreaterEqual(data['unresolved_imports_count'], 1)

    # ─── 4. Tree API Tests ────────────────────────────────────────────────────

    def test_architecture_tree_structure_and_search(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/tree/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data

            self.assertIn('tree', data)
            tree = data['tree']
            # Find 'core' directory
            core_node = next((node for node in tree if node['name'] == 'core'), None)
            self.assertIsNotNone(core_node)
            self.assertEqual(core_node['type'], 'directory')
            self.assertGreaterEqual(core_node['file_count'], 2)

            # Test search query
            res_search = self.client.get(f'/api/repositories/{self.repo.id}/architecture/tree/?search=models')
            self.assertEqual(res_search.status_code, status.HTTP_200_OK)
            models_tree = res_search.data['tree']
            core_search = next((node for node in models_tree if node['name'] == 'core'), None)
            self.assertIsNotNone(core_search)
            child_names = [c['name'] for c in core_search['children']]
            self.assertIn('models.py', child_names)

    # ─── 5. Graph API Tests ───────────────────────────────────────────────────

    def test_architecture_graph_nodes_and_edges(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data

            self.assertIn('nodes', data)
            self.assertIn('edges', data)
            self.assertFalse(data['is_truncated'])

            node_ids = {n['id'] for n in data['nodes']}
            self.assertIn('core/models.py', node_ids)
            self.assertIn('core/service.py', node_ids)
            self.assertIn('frontend/App.tsx', node_ids)
            self.assertIn('frontend/Widget.tsx', node_ids)

            # Check edge between frontend App.tsx and Widget.tsx
            app_edge = next(
                (e for e in data['edges'] if e['source'] == 'frontend/App.tsx' and e['target'] == 'frontend/Widget.tsx'),
                None
            )
            self.assertIsNotNone(app_edge)
            self.assertIn('Widget', app_edge['imported_symbols'])

    def test_architecture_graph_filtering_and_focus(self):
        with self._patch_repo_dir():
            # Test component_type filter
            res_models = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/?component_type=model')
            self.assertEqual(res_models.status_code, status.HTTP_200_OK)
            for node in res_models.data['nodes']:
                self.assertEqual(node['component_type'], 'model')

            # Test focus expansion around core/service.py
            res_focus = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/?focus=core/service.py')
            self.assertEqual(res_focus.status_code, status.HTTP_200_OK)
            focused_nodes = {n['id']: n for n in res_focus.data['nodes']}
            self.assertIn('core/service.py', focused_nodes)
            self.assertEqual(focused_nodes['core/service.py']['direction'], 'focus')
            self.assertIn('core/models.py', focused_nodes) # outgoing target
            self.assertEqual(focused_nodes['core/models.py']['direction'], 'outgoing')
            self.assertIn('api/views.py', focused_nodes)   # incoming dependent
            self.assertEqual(focused_nodes['api/views.py']['direction'], 'incoming')

            # Test limit bounding
            res_limited = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/?limit=3')
            self.assertEqual(res_limited.status_code, status.HTTP_200_OK)
            self.assertLessEqual(len(res_limited.data['nodes']), 3)
            self.assertTrue(res_limited.data['is_truncated'])

    def test_architecture_module_graph(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/?view_type=modules')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data
            self.assertIn('modules', data)
            self.assertIn('edges', data)
            module_ids = {m['id'] for m in data['modules']}
            self.assertIn('core', module_ids)
            self.assertIn('api', module_ids)
            self.assertIn('frontend', module_ids)
            # api depends on core
            api_to_core = next(
                (e for e in data['edges'] if e['source'] == 'api' and e['target'] == 'core'),
                None
            )
            self.assertIsNotNone(api_to_core)
            self.assertGreaterEqual(api_to_core['dependency_count'], 1)

    # ─── 6. Component Details Tests ───────────────────────────────────────────

    def test_component_details_success(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/node/?path=core/models.py')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            detail = res.data

            self.assertEqual(detail['file_path'], 'core/models.py')
            self.assertEqual(detail['name'], 'models.py')
            self.assertEqual(detail['component_type'], 'model')
            self.assertEqual(detail['language'], 'Python')
            self.assertEqual(
                detail['github_url'],
                'https://github.com/repomind/core-service/blob/main/core/models.py'
            )

            # Check incoming dependencies (core/service.py imports core/models.py)
            incoming_paths = [d['file_path'] for d in detail['incoming_dependencies']]
            self.assertIn('core/service.py', incoming_paths)

            # Check defined symbols from CodeChunk
            symbol_names = [s['name'] for s in detail['defined_symbols']]
            self.assertIn('UserModel', symbol_names)

    def test_component_details_not_found(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/node/?path=ghost/file.py')
            self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ─── 7. Architecture Findings Tests ───────────────────────────────────────

    def test_architecture_findings_detection(self):
        with self._patch_repo_dir():
            res = self.client.get(f'/api/repositories/{self.repo.id}/architecture/findings/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data

            # Check circular dependency detection between cycle_a.py and cycle_b.py
            self.assertGreaterEqual(data['circular_count'], 1)
            circ = next(
                (c for c in data['circular_dependencies'] if 'cycle_a.py' in c['cycle'] and 'cycle_b.py' in c['cycle']),
                None
            )
            self.assertIsNotNone(circ)
            self.assertEqual(circ['severity'], 'HIGH')

            # Check unresolved import detection in api/views.py ('non_existent_pkg')
            self.assertGreaterEqual(data['unresolved_count'], 1)
            unres = next(
                (u for u in data['unresolved_imports'] if u['module'] == 'non_existent_pkg'),
                None
            )
            self.assertIsNotNone(unres)
            self.assertEqual(unres['file_path'], 'api/views.py')
            self.assertEqual(unres['severity'], 'MEDIUM')

            # Check highly connected files
            self.assertIn('highly_connected_files', data)
            self.assertIn('highly_connected_count', data)

    # ─── 8. Empty Repository Tests ────────────────────────────────────────────

    def test_empty_repository_does_not_crash(self):
        empty_dir = tempfile.mkdtemp()
        try:
            with patch('architecture.views._get_user_repository', return_value=(self.repo, Path(empty_dir), None)):
                # Overview
                res_overview = self.client.get(f'/api/repositories/{self.repo.id}/architecture/')
                self.assertEqual(res_overview.status_code, status.HTTP_200_OK)
                self.assertEqual(res_overview.data['total_files'], 0)

                # Tree
                res_tree = self.client.get(f'/api/repositories/{self.repo.id}/architecture/tree/')
                self.assertEqual(res_tree.status_code, status.HTTP_200_OK)
                self.assertEqual(len(res_tree.data['tree']), 0)

                # Graph
                res_graph = self.client.get(f'/api/repositories/{self.repo.id}/architecture/graph/')
                self.assertEqual(res_graph.status_code, status.HTTP_200_OK)
                self.assertEqual(len(res_graph.data['nodes']), 0)

                # Findings
                res_findings = self.client.get(f'/api/repositories/{self.repo.id}/architecture/findings/')
                self.assertEqual(res_findings.status_code, status.HTTP_200_OK)
                self.assertEqual(res_findings.data['total_findings'], 0)
        finally:
            shutil.rmtree(empty_dir, ignore_errors=True)
