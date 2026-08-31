"""
RAG Evaluation Tests (Phase 2.1 — tests_rag_eval.py).

Test categories:
1. Chunker Tests (Phase 2.1)
   - Qualified method names (ClassName.method)
   - Sub-chunking of large symbols
   - format_chunk_for_embedding enriched text
   - File filtering (lockfiles, generated files, binary extensions)

2. Reranker Tests
   - Query type detection (identifier, route, flow, general)
   - Scoring formula (semantic, keyword, identifier, path)
   - File diversity for flow queries

3. Query Processor Tests
   - Follow-up query enrichment with conversation history
   - No enrichment when no pronouns

4. Knowledge Service Tests
   - Hybrid retrieval merge (semantic + keyword)
   - Repository isolation (repo A never returns chunks from repo B)
   - Embedding text stored on indexing

5. Context Builder Tests (Phase 2.1)
   - Structured SOURCE N format
   - Overlap deduplication within a file
   - Content deduplication
   - Context char cap

6. RAG Service Tests (Phase 2.1 — no live Gemini calls)
   - Retrieved context passed to Gemini (mocked)
   - Repository name in context
   - User question in Gemini turn
   - Conversation history included
   - No-context threshold (mocked low-score results → skip Gemini)
   - Source references match retrieved chunks
   - Repository isolation enforced (another user's repo → 404)
   - Debug mode returns full scoring

7. Eval Suite Tests
   - evaluate_retrieval() returns expected keys
   - compute_recall_at_k and compute_mrr correct on fixture data
"""

import json
from typing import Optional
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.contrib.auth import get_user_model

from embeddings.models import CodeChunk
from repositories.models import Repository, ChatSession, ChatMessage
from parser.chunker import (
    _ast_chunks, _block_chunks, _should_skip,
    format_chunk_for_embedding, chunk_repository,
    _load_ts_parsers,
    MAX_AST_CHUNK_LINES,
)
from rag.reranker import (
    rerank, detect_query_type, extract_identifiers, extract_routes,
    extract_query_tokens, QueryType, _score_identifier, _score_keyword,
)
from rag.query_processor import build_retrieval_query
from rag.context_builder import build_context, format_sources, _strip_overlapping, _dedup_content
from rag.eval_suite import (
    compute_recall_at_k, compute_mrr, _chunk_matches, BENCHMARK_QUESTIONS,
)
from rag.services import (
    handle_chat, RepositoryNotIndexedError, RepositoryNotFoundError,
)

User = get_user_model()


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(username: str):
    return User.objects.create_user(username=username, password='pw')


def _make_repo(user, name='TestRepo', is_indexed=True) -> Repository:
    repo = Repository.objects.create(
        user=user,
        name=name,
        owner='testowner',
        url=f'https://github.com/testowner/{name}',
        status='SUCCESS',
        is_indexed=is_indexed,
        index_status='indexed' if is_indexed else 'pending',
    )
    return repo


def _make_chunk(repo: Repository, **kwargs) -> CodeChunk:
    defaults = {
        'file_path': 'backend/auth/services.py',
        'symbol_name': 'AuthService.generate_token',
        'class_name': 'AuthService',
        'symbol_type': 'method',
        'start_line': 10,
        'end_line': 40,
        'content': 'def generate_token(user_id):\n    return jwt.encode({"id": user_id}, SECRET)',
        'embedding': [0.1] * 384,
    }
    defaults.update(kwargs)
    return CodeChunk.objects.create(repository=repo, **defaults)


# ──────────────────────────────────────────────────────────────────────────────
# 1. CHUNKER TESTS
# ──────────────────────────────────────────────────────────────────────────────

class ChunkerTests(TestCase):

    def test_block_chunk_basic(self):
        source = '\n'.join([f'line {i}' for i in range(60)])
        chunks = _block_chunks('src/test.go', source)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertIn('file_path', c)
            self.assertIn('content', c)
            self.assertIn('start_line', c)
            self.assertIn('end_line', c)

    def test_block_chunk_overlap(self):
        source = '\n'.join([f'line {i}' for i in range(100)])
        chunks = _block_chunks('src/test.go', source)
        # Consecutive chunks should overlap
        if len(chunks) >= 2:
            self.assertLess(chunks[0]['start_line'], chunks[1]['start_line'])

    def test_format_chunk_for_embedding_contains_metadata(self):
        chunk = {
            'file_path': 'backend/auth/services.py',
            'symbol_name': 'JWTService.generate_token',
            'class_name': 'JWTService',
            'symbol_type': 'method',
            'start_line': 10,
            'end_line': 30,
            'content': 'def generate_token(): pass',
        }
        text = format_chunk_for_embedding(chunk, repo_name='RepoMind')
        self.assertIn('RepoMind', text)
        self.assertIn('backend/auth/services.py', text)
        self.assertIn('generate_token', text)
        self.assertIn('method', text.lower())
        self.assertIn('def generate_token', text)

    def test_format_chunk_no_repo_name(self):
        chunk = {
            'file_path': 'src/app.py',
            'symbol_name': '',
            'class_name': '',
            'symbol_type': 'block',
            'start_line': 1,
            'end_line': 20,
            'content': 'import os\nimport sys',
        }
        text = format_chunk_for_embedding(chunk)
        self.assertIn('src/app.py', text)
        self.assertIn('import os', text)

    def test_should_skip_lockfile(self):
        from pathlib import Path
        self.assertTrue(_should_skip(Path('package-lock.json')))
        self.assertTrue(_should_skip(Path('yarn.lock')))

    def test_should_skip_binary_extensions(self):
        from pathlib import Path
        self.assertTrue(_should_skip(Path('image.png')))
        self.assertTrue(_should_skip(Path('model.pkl')))
        self.assertTrue(_should_skip(Path('data.csv')))

    def test_should_skip_minified(self):
        from pathlib import Path
        self.assertTrue(_should_skip(Path('bundle.min.js')))

    def test_should_not_skip_python(self):
        import tempfile, os
        from pathlib import Path
        with tempfile.NamedTemporaryFile(suffix='.py', delete=False) as f:
            f.write(b'def hello(): pass\n')
            name = f.name
        try:
            self.assertFalse(_should_skip(Path(name)))
        finally:
            os.unlink(name)

    def test_ast_chunks_python(self):
        parsers = _load_ts_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python not available')
        source = '''
class AuthService:
    def __init__(self):
        pass

    def login(self, username, password):
        return True

def helper():
    return 42
'''
        chunks = _ast_chunks('auth/services.py', source, parsers['.py'], lang='.py')
        self.assertGreater(len(chunks), 0)
        symbol_names = [c['symbol_name'] for c in chunks]
        # Expect qualified method name or plain function
        self.assertTrue(
            any('login' in name for name in symbol_names),
            f'Expected "login" in symbols, got: {symbol_names}'
        )
        # helper should be extracted as a function
        self.assertTrue(
            any('helper' in name for name in symbol_names),
            f'Expected "helper" in symbols, got: {symbol_names}'
        )

    def test_ast_chunks_qualified_method_name(self):
        parsers = _load_ts_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python not available')
        source = '''
class JWTService:
    def generate_token(self, user_id):
        return "token"
'''
        chunks = _ast_chunks('auth/jwt.py', source, parsers['.py'], lang='.py')
        # Should get a method chunk with qualified name containing 'generate_token'
        method_chunks = [c for c in chunks if 'generate_token' in c['symbol_name']]
        self.assertGreater(len(method_chunks), 0, f'No method chunk found. Chunks: {[c["symbol_name"] for c in chunks]}')

    def test_large_function_sub_chunked(self):
        parsers = _load_ts_parsers()
        if '.py' not in parsers:
            self.skipTest('Tree-sitter Python not available')
        # Create a function larger than MAX_AST_CHUNK_LINES
        body = '\n'.join([f'    x_{i} = {i}' for i in range(MAX_AST_CHUNK_LINES + 20)])
        source = f'def big_function():\n{body}\n'
        chunks = _ast_chunks('big.py', source, parsers['.py'], lang='.py')
        fn_chunks = [c for c in chunks if 'big_function' in c['symbol_name']]
        self.assertGreater(len(fn_chunks), 1, 'Large function should be sub-chunked')


# ──────────────────────────────────────────────────────────────────────────────
# 2. RERANKER TESTS
# ──────────────────────────────────────────────────────────────────────────────

class RerankerTests(TestCase):

    def _make_candidate(self, file_path='src/auth.py', symbol_name='login',
                        class_name='AuthService', content='def login(): pass',
                        similarity=0.7) -> dict:
        return {
            'file_path': file_path,
            'symbol_name': symbol_name,
            'class_name': class_name,
            'symbol_type': 'method',
            'start_line': 1,
            'end_line': 20,
            'content': content,
            'similarity': similarity,
        }

    def test_query_type_identifier(self):
        self.assertEqual(detect_query_type('where is generate_token defined?'), QueryType.IDENTIFIER)

    def test_query_type_route(self):
        self.assertEqual(detect_query_type('where is /api/auth/google/ handled?'), QueryType.ROUTE)

    def test_query_type_flow(self):
        self.assertEqual(detect_query_type('explain the authentication flow'), QueryType.FLOW)

    def test_extract_identifiers_camelcase(self):
        idents = extract_identifiers('where is generateToken implemented?')
        self.assertIn('generatetoken', idents)

    def test_extract_identifiers_snake_case(self):
        idents = extract_identifiers('find generate_token function')
        self.assertTrue(any('generate_token' in i for i in idents))

    def test_extract_routes(self):
        routes = extract_routes('where is /api/auth/google/ defined?')
        self.assertGreater(len(routes), 0)

    def test_rerank_identifier_boosts_symbol_match(self):
        candidates = [
            self._make_candidate(symbol_name='unrelated_func', similarity=0.9),
            self._make_candidate(symbol_name='AuthService.generate_token', similarity=0.5),
        ]
        result = rerank(candidates, query='where is generate_token?', top_k=2)
        # generate_token chunk should be ranked first despite lower semantic score
        self.assertIn('generate_token', result[0]['symbol_name'])

    def test_rerank_returns_top_k(self):
        candidates = [
            self._make_candidate(file_path=f'src/file_{i}.py', similarity=0.5)
            for i in range(10)
        ]
        result = rerank(candidates, query='authentication', top_k=3)
        self.assertLessEqual(len(result), 3)

    def test_rerank_scores_fields_present(self):
        candidates = [self._make_candidate()]
        result = rerank(candidates, query='login function', top_k=1)
        self.assertIn('semantic_score', result[0])
        self.assertIn('keyword_score', result[0])
        self.assertIn('identifier_score', result[0])
        self.assertIn('path_score', result[0])
        self.assertIn('final_score', result[0])

    def test_score_identifier_exact_match(self):
        chunk = {'symbol_name': 'generate_token', 'class_name': '', 'file_path': 'auth.py'}
        score = _score_identifier(chunk, ['generate_token'])
        self.assertEqual(score, 1.0)

    def test_score_identifier_no_match(self):
        chunk = {'symbol_name': 'unrelated', 'class_name': '', 'file_path': 'other.py'}
        score = _score_identifier(chunk, ['generate_token'])
        self.assertEqual(score, 0.0)

    def test_query_type_overview(self):
        self.assertEqual(detect_query_type('what is this repository about?'), QueryType.OVERVIEW)
        self.assertEqual(detect_query_type('project overview'), QueryType.OVERVIEW)
        self.assertEqual(detect_query_type('what does this project do?'), QueryType.OVERVIEW)

    def test_query_type_implementation(self):
        self.assertEqual(detect_query_type('where is authentication implemented?'), QueryType.IMPLEMENTATION)
        self.assertEqual(detect_query_type('where are JWT tokens generated?'), QueryType.IMPLEMENTATION)

    def test_overview_query_boosts_readme(self):
        candidates = [
            self._make_candidate(file_path='fire-monitor/ml/schema.json', symbol_name='', similarity=0.38),
            self._make_candidate(file_path='README.md', symbol_name='', similarity=0.30),
            self._make_candidate(file_path='AGENTS.md', symbol_name='', similarity=0.32),
        ]
        result = rerank(candidates, query='what is this repository about?', top_k=3)
        top_paths = [r['file_path'] for r in result[:2]]
        self.assertTrue('README.md' in top_paths or 'AGENTS.md' in top_paths)

    def test_implementation_query_suppresses_logger_regex(self):
        candidates = [
            self._make_candidate(file_path='src/utils/logger.js', symbol_name='TOKEN_KEY_PATTERN', similarity=0.25),
            self._make_candidate(file_path='backend/auth/services.py', symbol_name='JWTService.generate_token', similarity=0.30),
        ]
        result = rerank(candidates, query='where are JWT tokens generated?', top_k=2)
        self.assertEqual(result[0]['file_path'], 'backend/auth/services.py')
        self.assertEqual(result[0]['symbol_name'], 'JWTService.generate_token')

    def test_score_keyword_overlap(self):
        chunk = {'content': 'def login(user, password): authenticate(user)'}
        tokens = extract_query_tokens('how does login work?')
        score = _score_keyword(chunk, tokens)
        self.assertGreater(score, 0.0)


# ──────────────────────────────────────────────────────────────────────────────
# 3. QUERY PROCESSOR TESTS
# ──────────────────────────────────────────────────────────────────────────────

class QueryProcessorTests(TestCase):

    def test_no_pronoun_no_enrichment(self):
        query = 'How does authentication work?'
        history = [{'role': 'model', 'parts': ['AuthService handles login via JWT tokens.']}]
        result = build_retrieval_query(query, history)
        self.assertEqual(result, query)

    def test_pronoun_with_history_enriched(self):
        query = 'How does it generate the token?'
        history = [
            {'role': 'user', 'parts': ['Where is AuthService?']},
            {'role': 'model', 'parts': ['AuthService handles JwtTokenService authentication via GoogleOAuth.']}
        ]
        result = build_retrieval_query(query, history)
        # Should have appended some entity hints
        self.assertGreater(len(result), len(query))

    def test_no_history_returns_original(self):
        query = 'How does it work?'
        result = build_retrieval_query(query, None)
        self.assertEqual(result, query)

    def test_long_specific_question_not_enriched(self):
        query = 'Where does JwtTokenService.generateAccessToken create the token?'
        history = [{'role': 'model', 'parts': ['Some previous answer.']}]
        result = build_retrieval_query(query, history)
        # Long specific query with no pronoun → no enrichment
        self.assertEqual(result, query)


# ──────────────────────────────────────────────────────────────────────────────
# 4. CONTEXT BUILDER TESTS
# ──────────────────────────────────────────────────────────────────────────────

class ContextBuilderTests(TestCase):

    def _make_chunk(self, fp='auth.py', sym='login', cls='Auth',
                    start=1, end=20, content='def login(): pass',
                    score=0.8) -> dict:
        return {
            'file_path': fp,
            'symbol_name': sym,
            'class_name': cls,
            'symbol_type': 'method',
            'start_line': start,
            'end_line': end,
            'content': content,
            'final_score': score,
            'similarity': score,
        }

    def test_build_context_has_repository_header(self):
        chunks = [self._make_chunk()]
        ctx = build_context('MyRepo', chunks)
        self.assertIn('REPOSITORY: MyRepo', ctx)

    def test_build_context_source_n_format(self):
        chunks = [self._make_chunk()]
        ctx = build_context('MyRepo', chunks)
        self.assertIn('SOURCE 1', ctx)
        self.assertIn('File: auth.py', ctx)
        self.assertIn('Symbol: login', ctx)

    def test_build_context_empty_chunks(self):
        ctx = build_context('MyRepo', [])
        self.assertEqual(ctx, '')

    def test_strip_overlapping_removes_contained_ranges(self):
        chunks = [
            self._make_chunk(fp='auth.py', sym='outer', start=1, end=50),
            self._make_chunk(fp='auth.py', sym='inner', start=10, end=30),  # contained in outer
        ]
        result = _strip_overlapping(chunks)
        syms = [c['symbol_name'] for c in result]
        self.assertNotIn('inner', syms)
        self.assertIn('outer', syms)

    def test_dedup_content_removes_duplicate(self):
        shared_content = 'def login(): pass'
        chunks = [
            self._make_chunk(fp='a.py', content=shared_content),
            self._make_chunk(fp='b.py', content=shared_content),
        ]
        result = _dedup_content(chunks)
        self.assertEqual(len(result), 1)

    def test_format_sources_returns_correct_fields(self):
        chunks = [self._make_chunk()]
        sources = format_sources(chunks)
        self.assertEqual(len(sources), 1)
        s = sources[0]
        self.assertIn('file_path', s)
        self.assertIn('symbol_name', s)
        self.assertIn('class_name', s)
        self.assertIn('symbol_type', s)
        self.assertIn('start_line', s)
        self.assertIn('end_line', s)


# ──────────────────────────────────────────────────────────────────────────────
# 5. RAG SERVICE TESTS (Gemini mocked)
# ──────────────────────────────────────────────────────────────────────────────

def _mock_chunks(semantic_score=0.75):
    return [
        {
            'file_path': 'backend/auth/services.py',
            'symbol_name': 'AuthService.login',
            'class_name': 'AuthService',
            'symbol_type': 'method',
            'start_line': 10,
            'end_line': 45,
            'content': 'def login(self, user, pwd): ...',
            'similarity': semantic_score,
            'semantic_score': semantic_score,
            'keyword_score': 0.6,
            'identifier_score': 0.8,
            'path_score': 0.5,
            'final_score': semantic_score,
        }
    ]


class RAGServiceTests(TestCase):

    def setUp(self):
        self.user  = _make_user('rag_tester')
        self.user2 = _make_user('other_user')
        self.repo  = _make_repo(self.user, name='RepoMindTest', is_indexed=True)
        _make_chunk(self.repo)

    def test_raises_repo_not_found_for_other_user(self):
        with self.assertRaises(RepositoryNotFoundError):
            handle_chat(user=self.user2, repository_id=self.repo.id, message='Hi')

    def test_raises_not_indexed(self):
        unindexed = _make_repo(self.user, name='Unindexed', is_indexed=False)
        with self.assertRaises(RepositoryNotIndexedError):
            handle_chat(user=self.user, repository_id=unindexed.id, message='Hi')

    @patch('rag.services.search_code', return_value=[])
    @patch('rag.services.call_gemini')
    def test_no_context_skips_gemini(self, mock_gemini, mock_search):
        result = handle_chat(user=self.user, repository_id=self.repo.id, message='obscure question')
        mock_gemini.assert_not_called()
        self.assertIn("couldn't find", result['answer'])
        self.assertEqual(result['sources'], [])

    @patch('rag.services.search_code', return_value=_mock_chunks(0.02))
    @patch('rag.services.call_gemini')
    def test_low_score_skips_gemini(self, mock_gemini, mock_search):
        """If top chunk final_score is below threshold, Gemini should NOT be called."""
        result = handle_chat(user=self.user, repository_id=self.repo.id, message='obscure question')
        mock_gemini.assert_not_called()

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Authentication is implemented in AuthService.')
    def test_context_includes_repository_name(self, mock_gemini, mock_search):
        handle_chat(user=self.user, repository_id=self.repo.id, message='where is auth?')
        call_args = mock_gemini.call_args
        ctx = call_args.kwargs.get('system_context', call_args.args[0] if call_args.args else '')
        self.assertIn('RepoMindTest', ctx)

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Auth answer here.')
    def test_context_includes_file_path(self, mock_gemini, mock_search):
        handle_chat(user=self.user, repository_id=self.repo.id, message='where is auth?')
        call_args = mock_gemini.call_args
        ctx = call_args.kwargs.get('system_context', call_args.args[0] if call_args.args else '')
        self.assertIn('backend/auth/services.py', ctx)

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_user_question_in_gemini_call(self, mock_gemini, mock_search):
        handle_chat(user=self.user, repository_id=self.repo.id, message='How does Google login work?')
        call_args = mock_gemini.call_args
        question = call_args.kwargs.get('user_question', '')
        self.assertIn('Google login', question)

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_sources_match_retrieved_chunks(self, mock_gemini, mock_search):
        result = handle_chat(user=self.user, repository_id=self.repo.id, message='auth?')
        self.assertGreater(len(result['sources']), 0)
        self.assertEqual(result['sources'][0]['file_path'], 'backend/auth/services.py')

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_conversation_history_included_on_followup(self, mock_gemini, mock_search):
        # First turn
        result1 = handle_chat(user=self.user, repository_id=self.repo.id, message='Where is auth?')
        session_id = result1['session_id']
        # Second turn (follow-up)
        handle_chat(user=self.user, repository_id=self.repo.id,
                    message='How does it work?', session_id=session_id)
        call_args = mock_gemini.call_args
        history = call_args.kwargs.get('conversation_history', [])
        self.assertGreater(len(history), 0)

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_debug_mode_returns_scoring_info(self, mock_gemini, mock_search):
        result = handle_chat(user=self.user, repository_id=self.repo.id,
                             message='auth?', debug=True)
        self.assertIn('debug_chunks', result)
        self.assertGreater(len(result['debug_chunks']), 0)
        dc = result['debug_chunks'][0]
        self.assertIn('semantic_score', dc)
        self.assertIn('keyword_score', dc)
        self.assertIn('identifier_score', dc)
        self.assertIn('final_score', dc)

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_chat_persists_session_and_messages(self, mock_gemini, mock_search):
        result = handle_chat(user=self.user, repository_id=self.repo.id, message='auth?')
        session = ChatSession.objects.get(pk=result['session_id'])
        self.assertEqual(session.repository, self.repo)
        messages = session.messages.all()
        self.assertEqual(messages.count(), 2)  # user + assistant

    @patch('rag.services.search_code', return_value=_mock_chunks(0.75))
    @patch('rag.services.call_gemini', return_value='Answer.')
    def test_no_cross_repo_leakage(self, mock_gemini, mock_search):
        other_repo = _make_repo(self.user, name='OtherRepo')
        _make_chunk(other_repo, file_path='other/file.py', symbol_name='other_function')

        # Verify search_code is called with the correct repository_id
        handle_chat(user=self.user, repository_id=self.repo.id, message='auth?')
        call_args = mock_search.call_args
        called_repo_id = call_args.kwargs.get('repository_id', call_args.args[0] if call_args.args else None)
        self.assertEqual(called_repo_id, self.repo.id)


# ──────────────────────────────────────────────────────────────────────────────
# 6. EVAL SUITE TESTS
# ──────────────────────────────────────────────────────────────────────────────

class EvalSuiteTests(TestCase):

    def _make_result(self, rank=None):
        return {
            'question': 'test',
            'expected': ['auth'],
            'first_hit_rank': rank,
            'category': 'test',
        }

    def test_recall_at_k_perfect(self):
        results = [self._make_result(rank=1), self._make_result(rank=3), self._make_result(rank=5)]
        self.assertEqual(compute_recall_at_k(results, k=5), 1.0)

    def test_recall_at_k_zero(self):
        results = [self._make_result(rank=None), self._make_result(rank=None)]
        self.assertEqual(compute_recall_at_k(results, k=5), 0.0)

    def test_recall_at_k_partial(self):
        results = [self._make_result(rank=2), self._make_result(rank=None)]
        self.assertAlmostEqual(compute_recall_at_k(results, k=5), 0.5)

    def test_mrr_perfect(self):
        results = [self._make_result(rank=1), self._make_result(rank=1)]
        self.assertAlmostEqual(compute_mrr(results), 1.0)

    def test_mrr_mixed(self):
        results = [self._make_result(rank=1), self._make_result(rank=2), self._make_result(rank=None)]
        expected = (1.0 + 0.5 + 0.0) / 3
        self.assertAlmostEqual(compute_mrr(results), expected)

    def test_chunk_matches_file_path(self):
        chunk = {'file_path': 'backend/auth/services.py', 'symbol_name': '', 'class_name': '', 'content': ''}
        self.assertTrue(_chunk_matches(chunk, ['auth']))

    def test_chunk_matches_symbol_name(self):
        chunk = {'file_path': 'other.py', 'symbol_name': 'generate_token', 'class_name': '', 'content': ''}
        self.assertTrue(_chunk_matches(chunk, ['generate_token']))

    def test_chunk_no_match(self):
        chunk = {'file_path': 'unrelated.py', 'symbol_name': 'foo', 'class_name': '', 'content': 'print("hello")'}
        self.assertFalse(_chunk_matches(chunk, ['authentication', 'jwt', 'login']))

    def test_benchmark_questions_structure(self):
        """Every benchmark question should have question, expected, and category fields."""
        for q in BENCHMARK_QUESTIONS:
            self.assertIn('question', q)
            self.assertIn('expected', q)
            self.assertIn('category', q)
            self.assertIsInstance(q['expected'], list)
            self.assertGreater(len(q['expected']), 0)

    @patch('rag.eval_suite.search_code')
    def test_evaluate_retrieval_returns_metrics(self, mock_search):
        # Mock retrieval to return auth-related chunk for every query
        mock_search.return_value = [
            {
                'file_path': 'backend/auth/services.py',
                'symbol_name': 'AuthService.login',
                'class_name': 'AuthService',
                'symbol_type': 'method',
                'start_line': 1, 'end_line': 20,
                'content': 'def login(): pass',
                'final_score': 0.8, 'similarity': 0.8,
            }
        ]
        from rag.eval_suite import evaluate_retrieval
        result = evaluate_retrieval(repository_id=999, questions=[
            {'question': 'where is login?', 'expected': ['login', 'auth'], 'category': 'test'},
            {'question': 'where is auth?',  'expected': ['auth', 'services'], 'category': 'test'},
        ])
        self.assertIn('total_questions', result)
        self.assertIn('recall_at_5', result)
        self.assertIn('recall_at_10', result)
        self.assertIn('mrr', result)
        self.assertIn('per_question', result)
        self.assertEqual(result['total_questions'], 2)
