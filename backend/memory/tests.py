"""
Phase 3 Tests — Repository Memory.

Tests cover:
1. Commit chunker: structured embedding text generation
2. Paginated GitHub commit fetcher: pagination across multiple pages
3. Incremental indexing: stops at previously indexed commits without deleting history
4. Rate limit resilience: graceful handling of 403/429
5. Storage & models: CommitMemory persistence and repository-scoped isolation
6. Hybrid search: unified retrieval returning both code chunks and commit memories
7. Reranker query detection: QueryType.HISTORY boosting git commit evidence
8. Context builder & source formatting: commit-specific source rendering
9. Background task entry point: task_index_commit_history execution
"""

from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.test import TestCase

from repositories.models import Repository
from memory.models import CommitMemory
from memory.commit_chunker import format_commit_for_embedding
from memory.services import (
    fetch_commit_history,
    index_commit_history,
    task_index_commit_history,
)
from embeddings.models import CodeChunk
from embeddings.knowledge_service import (
    search_code_hybrid,
    _search_commit_memory,
)
from rag.reranker import rerank, detect_query_type, QueryType
from rag.context_builder import build_context, format_sources


class CommitChunkerTests(TestCase):
    def test_format_commit_for_embedding(self):
        commit = {
            'sha': 'abc1234567890abcdef',
            'author_name': 'Alice Developer',
            'committed_date': '2026-05-10T14:30:00Z',
            'message': 'Fix race condition in token refresh logic',
            'files_changed': [
                {'filename': 'auth/tokens.py', 'status': 'modified', 'additions': 10, 'deletions': 2},
                {'filename': 'tests/test_tokens.py', 'status': 'added', 'additions': 25, 'deletions': 0},
            ],
            'stats': {'total_additions': 35, 'total_deletions': 2, 'files_changed_count': 2},
        }
        text = format_commit_for_embedding(commit, repo_name='test-repo')
        self.assertIn('Repository: test-repo', text)
        self.assertIn('SHA: abc1234', text)
        self.assertIn('Author: Alice Developer', text)
        self.assertIn('2026-05-10', text)
        self.assertIn('Fix race condition in token refresh logic', text)
        self.assertIn('auth/tokens.py (modified: +10 -2)', text)
        self.assertIn('tests/test_tokens.py (added: +25 -0)', text)


class MemoryServicesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='memtest', password='password')
        self.repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/octocat/Hello-World',
            name='Hello-World',
            owner='octocat',
            status=Repository.Status.SUCCESS,
            is_indexed=True,
        )

    @patch('memory.services.GITHUB_PER_PAGE', 2)
    @patch('memory.services._get_github_session')
    def test_fetch_commit_history_pagination(self, mock_get_session):
        """Verify fetch_commit_history paginates through multiple pages."""
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session

        # Page 1: 2 commits, Page 2: 1 commit, Page 3: empty
        page1_resp = MagicMock(status_code=200)
        page1_resp.json.return_value = [
            {'sha': 'sha1', 'commit': {'message': 'Commit 1', 'author': {'name': 'Dev1'}, 'committer': {'date': '2026-01-01T00:00:00Z'}}},
            {'sha': 'sha2', 'commit': {'message': 'Commit 2', 'author': {'name': 'Dev2'}, 'committer': {'date': '2026-01-02T00:00:00Z'}}},
        ]
        page1_resp.headers = {'X-RateLimit-Remaining': '50'}

        page2_resp = MagicMock(status_code=200)
        page2_resp.json.return_value = [
            {'sha': 'sha3', 'commit': {'message': 'Commit 3', 'author': {'name': 'Dev3'}, 'committer': {'date': '2026-01-03T00:00:00Z'}}},
        ]
        page2_resp.headers = {'X-RateLimit-Remaining': '49'}

        # Commit details
        detail_resp = MagicMock(status_code=200)
        detail_resp.json.return_value = {'files': [{'filename': 'main.py', 'status': 'modified', 'additions': 5, 'deletions': 1}], 'stats': {'additions': 5, 'deletions': 1}}
        detail_resp.headers = {'X-RateLimit-Remaining': '48'}

        mock_session.get.side_effect = [page1_resp, page2_resp, detail_resp, detail_resp, detail_resp]

        commits = fetch_commit_history(self.repo, max_commits=3)
        self.assertEqual(len(commits), 3)
        self.assertEqual(commits[0]['sha'], 'sha1')
        self.assertEqual(commits[1]['sha'], 'sha2')
        self.assertEqual(commits[2]['sha'], 'sha3')

    @patch('memory.services._get_github_session')
    def test_fetch_commit_history_incremental_stop(self, mock_get_session):
        """Verify pagination stops early when encountering already-indexed commits."""
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session

        page1_resp = MagicMock(status_code=200)
        page1_resp.json.return_value = [
            {'sha': 'new_sha_1', 'commit': {'message': 'New 1', 'author': {'name': 'Dev1'}, 'committer': {'date': '2026-02-01T00:00:00Z'}}},
            {'sha': 'known_sha_old', 'commit': {'message': 'Old 2', 'author': {'name': 'Dev2'}, 'committer': {'date': '2026-01-01T00:00:00Z'}}},
            {'sha': 'known_sha_older', 'commit': {'message': 'Old 3', 'author': {'name': 'Dev3'}, 'committer': {'date': '2025-12-01T00:00:00Z'}}},
        ]
        page1_resp.headers = {'X-RateLimit-Remaining': '50'}

        detail_resp = MagicMock(status_code=200)
        detail_resp.json.return_value = {'files': [], 'stats': {}}
        detail_resp.headers = {'X-RateLimit-Remaining': '49'}

        mock_session.get.side_effect = [page1_resp, detail_resp]

        stop_at = {'known_sha_old', 'known_sha_older'}
        commits = fetch_commit_history(self.repo, stop_at_shas=stop_at, max_commits=10)
        # Should only have collected new_sha_1, halting when reaching known_sha_old
        self.assertEqual(len(commits), 1)
        self.assertEqual(commits[0]['sha'], 'new_sha_1')

    @patch('memory.services._get_github_session')
    def test_fetch_commit_history_rate_limit_handled_gracefully(self, mock_get_session):
        """Verify 403 rate limit response is caught and returns empty or partial list without error."""
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session

        rate_limited_resp = MagicMock(status_code=403)
        rate_limited_resp.headers = {'X-RateLimit-Remaining': '0'}
        mock_session.get.return_value = rate_limited_resp

        commits = fetch_commit_history(self.repo, max_commits=10)
        self.assertEqual(commits, [])

    @patch('memory.services.embed_batch')
    @patch('memory.services.fetch_commit_history')
    def test_index_commit_history_incremental_preservation(self, mock_fetch, mock_embed):
        """Verify indexing preserves existing commits and adds new commits incrementally."""
        mock_embed.return_value = [[0.1] * 384]

        # Initial indexing
        mock_fetch.return_value = [
            {
                'sha': 'sha_initial_1',
                'author_name': 'Author A',
                'author_email': 'a@example.com',
                'committed_date': '2026-01-01T12:00:00Z',
                'message': 'Initial commit',
                'files_changed': [{'filename': 'init.py', 'status': 'added', 'additions': 10, 'deletions': 0}],
                'stats': {'total_additions': 10, 'total_deletions': 0, 'files_changed_count': 1},
            }
        ]

        new_count = index_commit_history(self.repo, incremental=True)
        self.assertEqual(new_count, 1)
        self.assertEqual(CommitMemory.objects.filter(repository=self.repo).count(), 1)

        # Subsequent re-indexing with 1 new commit
        mock_fetch.return_value = [
            {
                'sha': 'sha_second_2',
                'author_name': 'Author B',
                'author_email': 'b@example.com',
                'committed_date': '2026-01-02T12:00:00Z',
                'message': 'Second commit',
                'files_changed': [{'filename': 'second.py', 'status': 'added', 'additions': 5, 'deletions': 0}],
                'stats': {'total_additions': 5, 'total_deletions': 0, 'files_changed_count': 1},
            }
        ]

        new_count_2 = index_commit_history(self.repo, incremental=True)
        self.assertEqual(new_count_2, 1)
        # Total in DB should now be 2: both original and new commit preserved!
        self.assertEqual(CommitMemory.objects.filter(repository=self.repo).count(), 2)

    @patch('memory.services.index_commit_history')
    def test_task_index_commit_history(self, mock_index):
        """Verify task_index_commit_history entry point runs and returns status."""
        mock_index.return_value = 5
        result = task_index_commit_history(self.repo.id, max_commits=50)
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['new_commits'], 5)


class MemoryRetrievalAndRAGTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='raguser', password='password')
        self.repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/testorg/testrepo',
            name='testrepo',
            owner='testorg',
            status=Repository.Status.SUCCESS,
            is_indexed=True,
        )
        self.repo2 = Repository.objects.create(
            user=self.user,
            url='https://github.com/otherorg/otherrepo',
            name='otherrepo',
            owner='otherorg',
            status=Repository.Status.SUCCESS,
            is_indexed=True,
        )

        # Create a code chunk
        self.code_chunk = CodeChunk.objects.create(
            repository=self.repo,
            file_path='src/auth.py',
            symbol_name='generate_token',
            symbol_type='function',
            start_line=10,
            end_line=25,
            content='def generate_token(): return "jwt"',
            embedding=[0.1] * 384,
            embedding_text='generate_token jwt',
        )

        # Create a commit memory for repo
        self.commit_mem = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='c0ffee1234567890abcdef1234567890abcdef12',
            author_name='Bob Architect',
            author_email='bob@example.com',
            committed_date=datetime(2026, 3, 15, 10, 0, 0, tzinfo=timezone.utc),
            message='Refactor token generation to use HS256 algorithm',
            files_changed=[{'filename': 'src/auth.py', 'status': 'modified', 'additions': 15, 'deletions': 8}],
            stats={'total_additions': 15, 'total_deletions': 8, 'files_changed_count': 1},
            embedding=[0.1] * 384,
            embedding_text='Refactor token generation to use HS256 algorithm',
        )

        # Create a commit memory for another repo (isolation check)
        self.other_commit = CommitMemory.objects.create(
            repository=self.repo2,
            commit_sha='deadbeef1234567890abcdef1234567890abcdef',
            author_name='Eve Hacker',
            author_email='eve@example.com',
            committed_date=datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc),
            message='Refactor token generation in other repo',
            embedding=[0.1] * 384,
            embedding_text='Refactor token generation in other repo',
        )

    def test_search_commit_memory_isolation(self):
        """Verify commit search is strictly repository-scoped."""
        results = _search_commit_memory(
            repository_id=self.repo.id,
            query_text='Refactor token',
            query_vec=[0.1] * 384,
            limit=5,
        )
        shas = [r['commit_sha'] for r in results]
        self.assertIn(self.commit_mem.commit_sha, shas)
        self.assertNotIn(self.other_commit.commit_sha, shas)

    @patch('embeddings.knowledge_service.embed_text')
    def test_search_code_hybrid_includes_commit_memory(self, mock_embed):
        """Verify hybrid retrieval surfaces both code chunks and commit memories."""
        mock_embed.return_value = [0.1] * 384
        candidates = search_code_hybrid(self.repo.id, query_text='Refactor token generation')

        types = {c.get('symbol_type') for c in candidates}
        self.assertIn('commit', types)
        self.assertIn('function', types)

    def test_reranker_history_query_boost(self):
        """Verify reranker detects history queries and prioritizes commit memories."""
        q = "Why was token generation refactored?"
        q_type = detect_query_type(q)
        self.assertEqual(q_type, QueryType.HISTORY)

        candidates = [
            {
                'id': 1,
                'file_path': 'src/auth.py',
                'symbol_name': 'generate_token',
                'symbol_type': 'function',
                'content': 'def generate_token(): pass',
                'similarity': 0.70,
            },
            {
                'id': 'commit-1',
                'file_path': 'commit:c0ffee1',
                'symbol_name': 'c0ffee1',
                'symbol_type': 'commit',
                'content': 'Commit c0ffee1: Refactor token generation to use HS256',
                'similarity': 0.70,
            }
        ]

        reranked = rerank(candidates, query=q, top_k=2)
        # Commit chunk should receive history boost and rank first
        self.assertEqual(reranked[0]['symbol_type'], 'commit')

    def test_context_builder_and_sources_for_commits(self):
        """Verify build_context and format_sources render git commits cleanly."""
        commit_chunk = {
            'id': 10,
            'file_path': 'commit:c0ffee1',
            'symbol_name': 'c0ffee1',
            'symbol_type': 'commit',
            'commit_sha': 'c0ffee1234567890abcdef',
            'author_name': 'Bob Architect',
            'committed_date': '2026-03-15T10:00:00Z',
            'content': 'Commit c0ffee1 by Bob Architect\nDate: 2026-03-15\nRefactor token generation',
            'similarity': 0.85,
        }

        context = build_context('testrepo', [commit_chunk])
        self.assertIn('Type: git_commit', context)
        self.assertIn('SHA: c0ffee1', context)
        self.assertIn('Author: Bob Architect', context)
        self.assertIn('Date: 2026-03-15', context)

        sources = format_sources([commit_chunk])
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['commit_sha'], 'c0ffee1234567890abcdef')
        self.assertEqual(sources[0]['author_name'], 'Bob Architect')
        self.assertEqual(sources[0]['symbol_type'], 'commit')
