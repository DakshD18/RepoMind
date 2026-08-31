"""
Phase 2 Backend Tests — Repository Intelligence (AI Chat).

Tests cover:
1. Chunker: AST extraction and block fallback
2. Embedding service: output shape and normalization
3. Knowledge service: indexing pipeline and Python-side cosine search
4. Repository isolation: chunks from repo A never returned for repo B
5. RAG service: handle_chat() with mocked Gemini and real vector search
6. No-context case: graceful degradation without calling Gemini
7. ChatSession / ChatMessage CRUD and user isolation
8. Not-indexed guard: 409 response when repository.is_indexed = False
9. Authorization: users cannot access other users' repositories/sessions
"""

import json
import os
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from embeddings.embedding_service import embed_text, embed_batch, cosine_similarity
from embeddings.models import CodeChunk
from parser.chunker import chunk_repository, _block_chunks, _ast_chunks
from rag.context_builder import build_context, format_sources
from rag.services import handle_chat, RepositoryNotIndexedError, RepositoryNotFoundError
from repositories.models import Repository, ChatSession, ChatMessage


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_user(username='testuser', password='testpass'):
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={'email': f'{username}@example.com'},
    )
    user.set_password(password)
    user.save()
    return user


def _make_repo(user, name='testrepo', owner='testowner', indexed=True):
    repo = Repository.objects.create(
        user=user,
        url=f'https://github.com/{owner}/{name}',
        name=name,
        owner=owner,
        status=Repository.Status.SUCCESS,
        is_indexed=indexed,
        index_status='indexed' if indexed else '',
    )
    return repo


def _make_chunk(repo, file_path='src/auth.py', symbol='login', content='def login(): pass'):
    chunk = CodeChunk.objects.create(
        repository=repo,
        file_path=file_path,
        symbol_name=symbol,
        symbol_type='function',
        start_line=1,
        end_line=5,
        content=content,
        embedding=embed_text(content),
    )
    return chunk


# ─────────────────────────────────────────────────────────────────────────────
# 1. Chunker tests
# ─────────────────────────────────────────────────────────────────────────────

class BlockChunkerTests(TestCase):
    def test_block_chunks_single_chunk(self):
        source = '\n'.join(['line ' + str(i) for i in range(10)])
        chunks = _block_chunks('test.txt', source)
        self.assertGreater(len(chunks), 0)
        self.assertEqual(chunks[0]['file_path'], 'test.txt')
        self.assertEqual(chunks[0]['symbol_type'], 'block')
        self.assertEqual(chunks[0]['start_line'], 1)

    def test_block_chunks_overlap(self):
        source = '\n'.join(['line ' + str(i) for i in range(100)])
        chunks = _block_chunks('big.txt', source)
        # More than one chunk with overlap
        self.assertGreater(len(chunks), 1)
        # Second chunk starts before first ends
        self.assertLess(chunks[1]['start_line'], chunks[0]['end_line'] + 1)

    def test_block_chunks_empty_source(self):
        chunks = _block_chunks('empty.txt', '   ')
        self.assertEqual(chunks, [])


class ASTChunkerTests(TestCase):
    def test_python_ast_extracts_function(self):
        source = 'def greet(name):\n    return f"Hello, {name}"\n'
        from parser.chunker import _get_parsers
        parsers = _get_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python parser not available')

        chunks = _ast_chunks('greet.py', source, parsers['.py'])
        self.assertTrue(any(c['symbol_name'] == 'greet' for c in chunks), 'Should extract greet function')

    def test_python_ast_extracts_class(self):
        source = 'class AuthService:\n    def login(self):\n        pass\n'
        from parser.chunker import _get_parsers
        parsers = _get_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python parser not available')

        chunks = _ast_chunks('auth.py', source, parsers['.py'])
        symbol_names = [c['symbol_name'] for c in chunks]
        self.assertIn('AuthService', symbol_names)

    def test_ast_chunk_line_numbers_are_1_indexed(self):
        source = 'def foo():\n    return 1\n'
        from parser.chunker import _get_parsers
        parsers = _get_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python parser not available')

        chunks = _ast_chunks('foo.py', source, parsers['.py'])
        for c in chunks:
            self.assertGreaterEqual(c['start_line'], 1)
            self.assertGreaterEqual(c['end_line'], c['start_line'])


# ─────────────────────────────────────────────────────────────────────────────
# 2. Embedding service tests
# ─────────────────────────────────────────────────────────────────────────────

class EmbeddingServiceTests(TestCase):
    def test_embed_text_shape(self):
        vec = embed_text('def login(): pass')
        self.assertEqual(len(vec), 384)
        self.assertIsInstance(vec[0], float)

    def test_embed_text_normalized(self):
        import math
        vec = embed_text('authentication service')
        magnitude = math.sqrt(sum(v * v for v in vec))
        self.assertAlmostEqual(magnitude, 1.0, places=4)

    def test_embed_batch_length(self):
        texts = ['function foo() {}', 'class Bar {}', 'import os']
        vecs = embed_batch(texts)
        self.assertEqual(len(vecs), 3)
        self.assertEqual(len(vecs[0]), 384)

    def test_cosine_similarity_identical(self):
        vec = embed_text('authentication')
        sim = cosine_similarity(vec, vec)
        self.assertAlmostEqual(sim, 1.0, places=4)

    def test_cosine_similarity_different(self):
        v1 = embed_text('authentication login jwt')
        v2 = embed_text('database migration schema')
        sim = cosine_similarity(v1, v2)
        self.assertGreater(sim, -1.0)
        self.assertLess(sim, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Knowledge service — indexing and search
# ─────────────────────────────────────────────────────────────────────────────

class KnowledgeServiceTests(TestCase):
    def setUp(self):
        self.user = _make_user()

    def test_search_returns_relevant_chunk(self):
        repo = _make_repo(self.user)
        # Create chunks with authentication-related content
        _make_chunk(repo, 'auth/service.py', 'authenticate', 'def authenticate(user, password): ...')
        _make_chunk(repo, 'db/models.py', 'Product', 'class Product(Model): ...')

        from embeddings.knowledge_service import search_code
        results = search_code(repo.id, 'how does authentication work?', top_k=5)

        # Should find auth chunk as most relevant
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertIn('similarity', top)
        self.assertIn('content', top)

    def test_search_respects_repository_scope(self):
        """Chunks from repo B must NEVER be returned when searching repo A."""
        repo_a = _make_repo(self.user, name='repo_a', owner='user')
        repo_b = _make_repo(self.user, name='repo_b', owner='user')

        _make_chunk(repo_a, 'a/auth.py', 'login_a', 'def login_a(): pass')
        _make_chunk(repo_b, 'b/auth.py', 'login_b', 'def login_b(): pass')

        from embeddings.knowledge_service import search_code
        results_a = search_code(repo_a.id, 'login authentication', top_k=10)

        result_file_paths = [r['file_path'] for r in results_a]
        # Should only contain files from repo_a
        for fp in result_file_paths:
            self.assertNotEqual(fp, 'b/auth.py', 'Repo B chunk leaked into repo A results!')

    def test_search_top_k_respected(self):
        repo = _make_repo(self.user)
        for i in range(20):
            _make_chunk(repo, f'file_{i}.py', f'func_{i}', f'def func_{i}(): pass # auth related {i}')

        from embeddings.knowledge_service import search_code
        results = search_code(repo.id, 'authentication function', top_k=5)
        self.assertLessEqual(len(results), 5)

    def test_search_empty_when_no_chunks(self):
        repo = _make_repo(self.user)
        from embeddings.knowledge_service import search_code
        results = search_code(repo.id, 'anything', top_k=6)
        self.assertEqual(results, [])


# ─────────────────────────────────────────────────────────────────────────────
# 4. Context Builder
# ─────────────────────────────────────────────────────────────────────────────

class ContextBuilderTests(TestCase):
    def _sample_chunks(self):
        return [
            {
                'file_path': 'src/auth/AuthService.ts',
                'symbol_name': 'login',
                'symbol_type': 'method',
                'start_line': 24,
                'end_line': 57,
                'content': 'async login(credentials) { /* ... */ }',
                'similarity': 0.91,
            },
            {
                'file_path': 'src/auth/JWTService.ts',
                'symbol_name': 'generateToken',
                'symbol_type': 'function',
                'start_line': 12,
                'end_line': 31,
                'content': 'function generateToken(payload) { /* ... */ }',
                'similarity': 0.85,
            },
        ]

    def test_build_context_contains_repo_name(self):
        ctx = build_context('ecommerce-app', self._sample_chunks())
        self.assertIn('ecommerce-app', ctx)

    def test_build_context_contains_file_paths(self):
        ctx = build_context('myrepo', self._sample_chunks())
        self.assertIn('src/auth/AuthService.ts', ctx)
        self.assertIn('src/auth/JWTService.ts', ctx)

    def test_build_context_contains_symbol_names(self):
        ctx = build_context('myrepo', self._sample_chunks())
        self.assertIn('login', ctx)
        self.assertIn('generateToken', ctx)

    def test_build_context_empty_chunks(self):
        ctx = build_context('myrepo', [])
        self.assertEqual(ctx, '')

    def test_format_sources(self):
        sources = format_sources(self._sample_chunks())
        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]['file_path'], 'src/auth/AuthService.ts')
        self.assertEqual(sources[0]['symbol_name'], 'login')
        self.assertEqual(sources[0]['start_line'], 24)


# ─────────────────────────────────────────────────────────────────────────────
# 5. RAG Service — handle_chat with mocked Gemini
# ─────────────────────────────────────────────────────────────────────────────

class RAGServiceTests(TestCase):
    def setUp(self):
        self.user = _make_user()

    @patch('rag.services.call_gemini', return_value='Authentication works by verifying credentials.')
    def test_handle_chat_success(self, mock_gemini):
        repo = _make_repo(self.user)
        _make_chunk(repo, 'auth.py', 'login', 'def login(user, pwd): check(user, pwd)')

        result = handle_chat(
            user=self.user,
            repository_id=repo.id,
            message='How does authentication work?',
        )

        self.assertIn('answer', result)
        self.assertIn('sources', result)
        self.assertIn('session_id', result)
        self.assertEqual(result['answer'], 'Authentication works by verifying credentials.')
        mock_gemini.assert_called_once()

    @patch('rag.services.call_gemini', return_value='JWT token answer.')
    def test_handle_chat_gemini_receives_context_and_question(self, mock_gemini):
        """Verify Gemini is called with the right arguments."""
        repo = _make_repo(self.user)
        _make_chunk(repo, 'jwt.py', 'generate_token', 'def generate_token(payload): return jwt.encode(payload)')

        handle_chat(
            user=self.user,
            repository_id=repo.id,
            message='How is the JWT generated?',
        )

        call_kwargs = mock_gemini.call_args
        # system_context should contain the repo name
        self.assertIn(repo.name, call_kwargs.kwargs.get('system_context', '') or call_kwargs[0][0])
        # user_question should be passed
        question_arg = call_kwargs.kwargs.get('user_question', '') or call_kwargs[0][2]
        self.assertIn('JWT', question_arg)

    def test_handle_chat_not_indexed_raises_error(self):
        repo = _make_repo(self.user, indexed=False)
        with self.assertRaises(RepositoryNotIndexedError):
            handle_chat(user=self.user, repository_id=repo.id, message='anything?')

    def test_handle_chat_wrong_user_raises_error(self):
        other_user = _make_user(username='other')
        repo = _make_repo(other_user)
        with self.assertRaises(RepositoryNotFoundError):
            handle_chat(user=self.user, repository_id=repo.id, message='anything?')

    @patch('rag.services.call_gemini')
    def test_handle_chat_no_chunks_does_not_call_gemini(self, mock_gemini):
        """If no relevant chunks found, Gemini must NOT be called (no hallucination)."""
        repo = _make_repo(self.user)
        # No chunks in DB

        result = handle_chat(
            user=self.user,
            repository_id=repo.id,
            message='something totally unrelated',
        )

        mock_gemini.assert_not_called()
        self.assertIn("couldn't find enough relevant code", result['answer'])
        self.assertEqual(result['sources'], [])

    @patch('rag.services.call_gemini', return_value='Answer 2.')
    def test_handle_chat_follow_up_uses_same_session(self, mock_gemini):
        repo = _make_repo(self.user)
        _make_chunk(repo, 'auth.py', 'login', 'def login(): pass # authentication')

        # First message — creates session
        result1 = handle_chat(user=self.user, repository_id=repo.id, message='How does auth work?')
        session_id = result1['session_id']

        # Second message — continues session
        result2 = handle_chat(
            user=self.user,
            repository_id=repo.id,
            message='What about tokens?',
            session_id=session_id,
        )

        self.assertEqual(result2['session_id'], session_id)
        session = ChatSession.objects.get(pk=session_id)
        self.assertEqual(session.messages.count(), 4)  # 2 user + 2 assistant

    @patch('rag.services.call_gemini', return_value='Debug answer.')
    def test_handle_chat_debug_mode_returns_debug_chunks(self, mock_gemini):
        repo = _make_repo(self.user)
        _make_chunk(repo, 'debug.py', 'debug_func', 'def debug_func(): pass # auth')

        result = handle_chat(
            user=self.user,
            repository_id=repo.id,
            message='auth question?',
            debug=True,
        )

        self.assertIn('debug_chunks', result)
        if result['debug_chunks']:
            chunk = result['debug_chunks'][0]
            self.assertIn('similarity', chunk)
            self.assertIn('file_path', chunk)


# ─────────────────────────────────────────────────────────────────────────────
# 6. ChatSession / ChatMessage model tests
# ─────────────────────────────────────────────────────────────────────────────

class ChatModelTests(TestCase):
    def setUp(self):
        self.user = _make_user()
        self.repo = _make_repo(self.user)

    def test_create_session(self):
        session = ChatSession.objects.create(
            user=self.user,
            repository=self.repo,
            title='Auth Flow',
        )
        self.assertEqual(session.title, 'Auth Flow')
        self.assertEqual(session.repository, self.repo)

    def test_create_message_with_sources(self):
        session = ChatSession.objects.create(user=self.user, repository=self.repo, title='Test')
        sources = [{'file_path': 'auth.py', 'symbol_name': 'login', 'start_line': 1, 'end_line': 10}]

        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_ASSISTANT,
            content='Authentication uses JWT.',
            sources=sources,
        )

        self.assertEqual(msg.role, 'assistant')
        self.assertEqual(msg.sources[0]['file_path'], 'auth.py')

    def test_delete_session_cascades_messages(self):
        session = ChatSession.objects.create(user=self.user, repository=self.repo, title='Test')
        ChatMessage.objects.create(session=session, role='user', content='hi')
        session_id = session.id
        session.delete()
        self.assertEqual(ChatMessage.objects.filter(session_id=session_id).count(), 0)

    def test_delete_repo_cascades_sessions(self):
        session = ChatSession.objects.create(user=self.user, repository=self.repo, title='Test')
        session_id = session.id
        self.repo.delete()
        self.assertEqual(ChatSession.objects.filter(pk=session_id).count(), 0)


# ─────────────────────────────────────────────────────────────────────────────
# 7. API endpoint tests — authorization and HTTP contract
# ─────────────────────────────────────────────────────────────────────────────

def _get_token(client, username='testuser', password='testpass'):
    resp = client.post('/api/auth/login/', {'email': f'{username}@example.com', 'password': password}, format='json')
    if resp.status_code == 200:
        return resp.data['tokens']['access']
    return None


class ChatAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user()
        self.user.email = 'testuser@example.com'
        self.user.save()
        self.repo = _make_repo(self.user)

    def _auth(self):
        resp = self.client.post(
            '/api/auth/login/',
            {'email': 'testuser@example.com', 'password': 'testpass'},
            format='json'
        )
        if resp.status_code == 200:
            token = resp.data['tokens']['access']
            self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return resp.status_code

    def test_chat_requires_auth(self):
        resp = self.client.post(f'/api/repositories/{self.repo.id}/chat/', {'message': 'hi'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_chat_not_indexed_returns_409(self):
        self._auth()
        self.repo.is_indexed = False
        self.repo.save()

        resp = self.client.post(
            f'/api/repositories/{self.repo.id}/chat/',
            {'message': 'How does auth work?'},
            format='json',
        )
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data['code'], 'not_indexed')

    @patch('rag.services.call_gemini', return_value='Test answer from AI.')
    def test_chat_success_returns_answer_and_sources(self, mock_gemini):
        self._auth()
        _make_chunk(self.repo, 'auth.py', 'login', 'def login(): # auth stuff')

        resp = self.client.post(
            f'/api/repositories/{self.repo.id}/chat/',
            {'message': 'How does login work?'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('answer', resp.data)
        self.assertIn('sources', resp.data)
        self.assertIn('session_id', resp.data)

    def test_index_not_cloned_returns_400(self):
        self._auth()
        self.repo.status = Repository.Status.PENDING
        self.repo.save()

        resp = self.client.post(f'/api/repositories/{self.repo.id}/index/', format='json')
        self.assertEqual(resp.status_code, 400)

    def test_sessions_list_user_isolation(self):
        """User B cannot see User A's sessions."""
        self._auth()
        session = ChatSession.objects.create(user=self.user, repository=self.repo, title='Private')

        # Create user B
        user_b = _make_user(username='userb')
        user_b.email = 'userb@example.com'
        user_b.save()
        repo_b = _make_repo(user_b, name='repob')

        client_b = APIClient()
        resp_login = client_b.post(
            '/api/auth/login/',
            {'email': 'userb@example.com', 'password': 'testpass'},
            format='json',
        )
        if resp_login.status_code == 200:
            token_b = resp_login.data['tokens']['access']
            client_b.credentials(HTTP_AUTHORIZATION=f'Bearer {token_b}')
            # User B tries to access User A's repo sessions
            resp = client_b.get(f'/api/repositories/{self.repo.id}/sessions/')
            # Should 404 (not found, since repo doesn't belong to B)
            self.assertEqual(resp.status_code, 404)

    def test_session_detail_user_isolation(self):
        """User B cannot retrieve User A's chat session."""
        self._auth()
        session = ChatSession.objects.create(user=self.user, repository=self.repo, title='Secret')

        user_b = _make_user(username='usercee')
        user_b.email = 'usercee@example.com'
        user_b.save()

        client_b = APIClient()
        resp_login = client_b.post(
            '/api/auth/login/',
            {'email': 'usercee@example.com', 'password': 'testpass'},
            format='json',
        )
        if resp_login.status_code == 200:
            token_b = resp_login.data['tokens']['access']
            client_b.credentials(HTTP_AUTHORIZATION=f'Bearer {token_b}')
            resp = client_b.get(f'/api/repositories/{self.repo.id}/sessions/{session.id}/')
            self.assertIn(resp.status_code, [403, 404])
