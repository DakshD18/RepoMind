"""
Phase 3.5 — Strict RAG Grounding & Hallucination Fix Tests.

Comprehensive evaluation covering:
1. "what is this repository about?" (OVERVIEW intent, prioritizes docs)
2. "where is authentication implemented?" (IMPLEMENTATION intent, prefers auth implementation)
3. "where are JWT tokens generated?" (exact symbol/file outranks passive utilities)
4. "where is the map component?" (IDENTIFIER/component lookup)
5. "which API is used for maps?" (API intent)
6. "who implemented authentication?" (HISTORY intent, requires CommitMemory)
7. "when was authentication added?" (HISTORY intent, requires CommitMemory)
8. "in which commit was authentication introduced?" (HISTORY intent, requires CommitMemory)
9. "why was Redis introduced?" (HISTORY intent, explains rationale from commit)
10. "what does this project use Gemini for?" (DEPENDENCY intent)
11. "what is the frontend architecture?" (ARCHITECTURE intent)
12. "how does frontend communicate with backend?" (ARCHITECTURE intent)
13. Irrelevant chunk rejection (spatial_enrich.py rejected for auth questions)
14. No-context gate activation on non-existent features (Stripe payment processing)
15. Answer validator intercepting hallucinated file citations
16. Repository isolation verification
"""

from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.contrib.auth import get_user_model

from repositories.models import Repository, ChatSession, ChatMessage
from embeddings.models import CodeChunk
from memory.models import CommitMemory
from rag.reranker import (
    rerank,
    detect_query_type,
    QueryType,
    _is_passive_utility,
    extract_core_entities,
)
from rag.services import handle_chat
from rag.validator import validate_answer
from embeddings.knowledge_service import search_code

User = get_user_model()


class RAGGroundingTestSuite(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='grounding_user', password='password')
        self.repo = Repository.objects.create(
            user=self.user,
            name='GeoPlatform',
            owner='geo-team',
            url='https://github.com/geo-team/GeoPlatform',
            status='SUCCESS',
            is_indexed=True,
            index_status='indexed',
        )

        # ── Code Chunks ────────────────────────────────────────────────────────
        # 1. Auth implementation
        self.chunk_auth_views = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/auth/views.py',
            symbol_name='GoogleAuthView.post',
            class_name='GoogleAuthView',
            symbol_type='method',
            start_line=25,
            end_line=60,
            content='class GoogleAuthView(APIView):\n    def post(self, request):\n        token = request.data.get("credential")\n        user = authenticate_google_user(token)\n        return Response({"token": generate_jwt(user)})',
            embedding=[0.05] * 384,
            embedding_text='GoogleAuthView authentication login google user token',
        )

        # 2. JWT Generation
        self.chunk_jwt = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/auth/jwt_service.py',
            symbol_name='JWTService.generate_token',
            class_name='JWTService',
            symbol_type='method',
            start_line=10,
            end_line=35,
            content='class JWTService:\n    @staticmethod\n    def generate_token(user):\n        payload = {"user_id": user.id, "exp": datetime.utcnow() + timedelta(hours=1)}\n        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")',
            embedding=[0.06] * 384,
            embedding_text='JWTService generate_token jwt tokens create sign HS256',
        )

        # 3. Map Component
        self.chunk_map = CodeChunk.objects.create(
            repository=self.repo,
            file_path='frontend/src/components/Map/MapView.tsx',
            symbol_name='MapView',
            symbol_type='function',
            start_line=1,
            end_line=50,
            content='export const MapView = ({ coordinates }) => {\n    return <div className="map-container"><MapContainer center={coordinates} zoom={13}><TileLayer url="https://api.mapbox.com" /></MapContainer></div>;\n};',
            embedding=[0.08] * 384,
            embedding_text='MapView React map component Mapbox Leaflet tiles coordinates',
        )

        # 4. Maps API
        self.chunk_maps_api = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/api/maps_views.py',
            symbol_name='MapTilesView.get',
            class_name='MapTilesView',
            symbol_type='method',
            start_line=1,
            end_line=30,
            content='class MapTilesView(APIView):\n    def get(self, request):\n        # Proxies Mapbox Vector Tile API\n        return fetch_mapbox_tiles(request.query_params)',
            embedding=[0.07] * 384,
            embedding_text='MapTilesView maps api endpoint Mapbox vector tiles REST',
        )

        # 5. README documentation
        self.chunk_readme = CodeChunk.objects.create(
            repository=self.repo,
            file_path='README.md',
            symbol_name='Overview',
            symbol_type='module',
            start_line=1,
            end_line=40,
            content='# GeoPlatform\n\nGeoPlatform is a geospatial data visualization system integrating Mapbox tiles and satellite imagery with AI analysis.',
            embedding=[0.04] * 384,
            embedding_text='GeoPlatform overview geospatial data visualization system Mapbox satellite AI analysis',
        )

        # 6. Architecture documentation
        self.chunk_arch = CodeChunk.objects.create(
            repository=self.repo,
            file_path='docs/architecture.md',
            symbol_name='Architecture',
            symbol_type='module',
            start_line=1,
            end_line=50,
            content='## System Architecture\n\nThe frontend is a React SPA communicating with Django REST Framework backend via Axios HTTP requests and JWT bearer tokens.',
            embedding=[0.05] * 384,
            embedding_text='System Architecture frontend React communicate backend Django REST Framework Axios HTTP JWT',
        )

        # 7. Dependencies manifest
        self.chunk_deps = CodeChunk.objects.create(
            repository=self.repo,
            file_path='package.json',
            symbol_name='dependencies',
            symbol_type='module',
            start_line=1,
            end_line=30,
            content='{\n  "name": "geoplatform-frontend",\n  "dependencies": {\n    "@google/genai": "^0.1.1",\n    "leaflet": "^1.9.4",\n    "react": "^18.2.0"\n  }\n}',
            embedding=[0.03] * 384,
            embedding_text='package.json dependencies google genai gemini sdk leaflet react packages',
        )

        # 8. Configuration
        self.chunk_config = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/config/settings.py',
            symbol_name='CACHES',
            symbol_type='block',
            start_line=80,
            end_line=110,
            content='CACHES = {\n    "default": {\n        "BACKEND": "django_redis.cache.RedisCache",\n        "LOCATION": "redis://127.0.0.1:6379/1",\n    }\n}',
            embedding=[0.04] * 384,
            embedding_text='settings CACHES Redis cache configuration redis://127.0.0.1:6379 database setup',
        )

        # 9. Passive Utilities & Data Mappers (Potential noise / distractor)
        self.chunk_spatial_enrich = CodeChunk.objects.create(
            repository=self.repo,
            file_path='scripts/spatial_enrich.py',
            symbol_name='enrich_landcover',
            symbol_type='function',
            start_line=1,
            end_line=60,
            content='def enrich_landcover(polygon):\n    # lookup table for raster soil classification\n    soil_matrix = [[0.1, 0.4], [0.9, 0.2]]\n    return calculate_elevation_slope(polygon, soil_matrix)',
            embedding=[0.01] * 384,
            embedding_text='enrich_landcover polygon soil matrix lookup table spatial raster calculate',
        )

        self.chunk_logger = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/utils/logger.py',
            symbol_name='mask_tokens',
            symbol_type='function',
            start_line=1,
            end_line=20,
            content='TOKEN_MASK_PATTERN = r"Bearer\\s+([A-Za-z0-9._-]+)"\ndef mask_tokens(text):\n    return re.sub(TOKEN_MASK_PATTERN, "Bearer [REDACTED]", text)',
            embedding=[0.02] * 384,
            embedding_text='mask_tokens TOKEN_MASK_PATTERN logger logging redact Bearer',
        )

        # 10. Main application logic entry point
        self.chunk_main = CodeChunk.objects.create(
            repository=self.repo,
            file_path='backend/main.py',
            symbol_name='create_app',
            symbol_type='function',
            start_line=1,
            end_line=45,
            content='def create_app():\n    app = FastAPI(title="GeoPlatform")\n    app.include_router(auth_router)\n    return app',
            embedding=[0.05] * 384,
            embedding_text='main application logic entry point create_app FastAPI router',
        )

        # 11. Stylesheet (noise for logic questions)
        self.chunk_css = CodeChunk.objects.create(
            repository=self.repo,
            file_path='frontend/src/index.css',
            symbol_name='root_styles',
            symbol_type='block',
            start_line=1,
            end_line=30,
            content=':root { --main-color: #3b82f6; --bg: #ffffff; }\nbody { margin: 0; font-family: Inter, sans-serif; }',
            embedding=[0.02] * 384,
            embedding_text='index.css root styles main-color body font-family',
        )

        # 12. Static UI script (noise for core logic questions)
        self.chunk_asset_js = CodeChunk.objects.create(
            repository=self.repo,
            file_path='assets/js/main.js',
            symbol_name='init_scroll',
            symbol_type='function',
            start_line=1,
            end_line=25,
            content='function init_scroll() {\n    window.addEventListener("scroll", () => console.log("scrolling"));\n}',
            embedding=[0.02] * 384,
            embedding_text='assets js main init_scroll eventListener window scrolling',
        )

        # ── Commit Memories ───────────────────────────────────────────────────
        self.commit_auth = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
            author_name='Alice Developer',
            author_email='alice@example.com',
            committed_date=datetime(2026, 2, 15, 14, 30, 0, tzinfo=timezone.utc),
            message='Implement Google authentication and JWT token issuance',
            files_changed=[
                {'filename': 'backend/auth/views.py', 'status': 'added', 'additions': 45, 'deletions': 0},
                {'filename': 'backend/auth/jwt_service.py', 'status': 'added', 'additions': 30, 'deletions': 0},
            ],
            stats={'total_additions': 75, 'total_deletions': 0, 'files_changed_count': 2},
            embedding=[0.05] * 384,
            embedding_text='Implement Google authentication and JWT token issuance by Alice Developer',
        )

        self.commit_redis = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='f9e8d7c6b5a4031234567890abcdef1234567890',
            author_name='Bob Architect',
            author_email='bob@example.com',
            committed_date=datetime(2026, 3, 1, 9, 15, 0, tzinfo=timezone.utc),
            message='Introduce Redis for session caching and rate limiting',
            files_changed=[
                {'filename': 'backend/config/settings.py', 'status': 'modified', 'additions': 18, 'deletions': 2},
            ],
            stats={'total_additions': 18, 'total_deletions': 2, 'files_changed_count': 1},
            embedding=[0.04] * 384,
            embedding_text='Introduce Redis for session caching and rate limiting by Bob Architect',
        )

    # ── Test 1: Overview Query ─────────────────────────────────────────────────
    def test_query_overview_prioritizes_docs(self):
        q = "what is this repository about?"
        self.assertEqual(detect_query_type(q), QueryType.OVERVIEW)

        candidates = [
            {'file_path': 'README.md', 'symbol_name': 'Overview', 'similarity': 0.45},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'enrich_landcover', 'similarity': 0.40},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['file_path'], 'README.md')

    # ── Test 2: Where is authentication implemented? ───────────────────────────
    def test_query_where_is_authentication_implemented(self):
        q = "where is authentication implemented?"
        self.assertEqual(detect_query_type(q), QueryType.IMPLEMENTATION)

        candidates = [
            {'file_path': 'backend/auth/views.py', 'symbol_name': 'GoogleAuthView', 'similarity': 0.55, 'content': 'class GoogleAuthView: authenticate'},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'enrich_landcover', 'similarity': 0.35, 'content': 'def enrich_landcover(polygon): pass'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(len(reranked), 1)
        self.assertEqual(reranked[0]['file_path'], 'backend/auth/views.py')

    # ── Test 3: Where are JWT tokens generated? ───────────────────────────────
    def test_query_jwt_tokens_outranks_passive_logger(self):
        q = "where are JWT tokens generated?"
        candidates = [
            {'file_path': 'backend/auth/jwt_service.py', 'symbol_name': 'JWTService.generate_token', 'similarity': 0.60, 'content': 'def generate_token(user): jwt.encode'},
            {'file_path': 'backend/utils/logger.py', 'symbol_name': 'mask_tokens', 'similarity': 0.58, 'content': 'TOKEN_MASK_PATTERN = Bearer'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['file_path'], 'backend/auth/jwt_service.py')

    # ── Test 4: Where is the map component? ────────────────────────────────────
    def test_query_where_is_map_component(self):
        q = "where is the map component?"
        candidates = [
            {'file_path': 'frontend/src/components/Map/MapView.tsx', 'symbol_name': 'MapView', 'similarity': 0.65, 'content': 'export const MapView = () => <MapContainer />'},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'enrich', 'similarity': 0.30, 'content': 'polygon raster'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['file_path'], 'frontend/src/components/Map/MapView.tsx')

    # ── Test 5: Which API is used for maps? ───────────────────────────────────
    def test_query_which_api_for_maps(self):
        q = "which API is used for maps?"
        self.assertEqual(detect_query_type(q), QueryType.API)
        candidates = [
            {'file_path': 'backend/api/maps_views.py', 'symbol_name': 'MapTilesView', 'similarity': 0.55, 'content': 'fetch_mapbox_tiles'},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'soil_matrix', 'similarity': 0.32, 'content': 'matrix'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['file_path'], 'backend/api/maps_views.py')

    # ── Test 6, 7, 8: History Queries with CommitMemory ────────────────────────
    def test_query_who_implemented_authentication(self):
        q = "who implemented authentication?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        candidates = [
            {
                'file_path': 'commit:a1b2c3d',
                'symbol_name': 'a1b2c3d',
                'symbol_type': 'commit',
                'commit_sha': 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
                'author_name': 'Alice Developer',
                'content': 'Implement Google authentication and JWT token issuance',
                'similarity': 0.55,
            },
            {
                'file_path': 'backend/auth/views.py',
                'symbol_name': 'GoogleAuthView',
                'symbol_type': 'method',
                'content': 'class GoogleAuthView: pass',
                'similarity': 0.50,
            }
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['symbol_type'], 'commit')
        self.assertEqual(reranked[0]['author_name'], 'Alice Developer')

    def test_query_when_and_which_commit_authentication(self):
        q = "in which commit was authentication introduced?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        candidates = [
            {
                'file_path': 'commit:a1b2c3d',
                'symbol_name': 'a1b2c3d',
                'symbol_type': 'commit',
                'commit_sha': 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
                'content': 'Implement Google authentication and JWT token issuance',
                'similarity': 0.60,
            }
        ]
        reranked = rerank(candidates, query=q, top_k=1)
        self.assertEqual(len(reranked), 1)
        self.assertEqual(reranked[0]['commit_sha'][:7], 'a1b2c3d')

    # ── Test 9: Why was Redis introduced? ──────────────────────────────────────
    def test_query_why_was_redis_introduced(self):
        q = "why was Redis introduced?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        candidates = [
            {
                'file_path': 'commit:f9e8d7c',
                'symbol_name': 'f9e8d7c',
                'symbol_type': 'commit',
                'content': 'Introduce Redis for session caching and rate limiting',
                'similarity': 0.58,
            },
            {
                'file_path': 'backend/config/settings.py',
                'symbol_name': 'CACHES',
                'symbol_type': 'block',
                'content': 'CACHES = {"default": {"BACKEND": "django_redis.cache.RedisCache"}}',
                'similarity': 0.50,
            }
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['symbol_type'], 'commit')

    # ── Test 10: Dependencies query ───────────────────────────────────────────
    def test_query_gemini_dependency(self):
        q = "what does this project use Gemini for?"
        self.assertEqual(detect_query_type(q), QueryType.DEPENDENCY)
        candidates = [
            {'file_path': 'package.json', 'symbol_name': 'dependencies', 'similarity': 0.55, 'content': '"@google/genai": "^0.1.1"'},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'enrich', 'similarity': 0.25, 'content': 'polygon'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(reranked[0]['file_path'], 'package.json')

    # ── Test 11 & 12: Architecture & Communication ─────────────────────────────
    def test_query_frontend_backend_communication(self):
        q = "how does frontend communicate with backend?"
        self.assertEqual(detect_query_type(q), QueryType.ARCHITECTURE)
        candidates = [
            {'file_path': 'docs/architecture.md', 'symbol_name': 'Architecture', 'similarity': 0.60, 'content': 'React SPA communicating with Django REST Framework backend via Axios HTTP requests and JWT bearer tokens'},
            {'file_path': 'scripts/spatial_enrich.py', 'symbol_name': 'soil_matrix', 'similarity': 0.20, 'content': 'soil_matrix'},
        ]
        reranked = rerank(candidates, query=q, top_k=2)
        self.assertEqual(len(reranked), 1)
        self.assertEqual(reranked[0]['file_path'], 'docs/architecture.md')

    # ── Test 13: Irrelevant Chunk Rejection (spatial_enrich for auth) ───────────
    def test_irrelevant_chunks_are_rejected(self):
        q = "explain all the authentication of this project, when and who did it and in which commit"
        candidates = [
            {
                'file_path': 'scripts/spatial_enrich.py',
                'symbol_name': 'enrich_landcover',
                'symbol_type': 'function',
                'content': 'lookup table for raster soil classification calculate_elevation_slope',
                'similarity': 0.28,  # Typical noisy cosine similarity
            },
            {
                'file_path': 'backend/data/landcover_lookup.py',
                'symbol_name': 'LANDCOVER_CODES',
                'symbol_type': 'block',
                'content': 'LANDCOVER_CODES = {10: "Tree Cover", 20: "Shrubland"}',
                'similarity': 0.24,
            }
        ]
        reranked, evaluated = rerank(candidates, query=q, top_k=5, return_all_evaluated=True)
        # Both spatial chunks must be strictly rejected
        self.assertEqual(len(reranked), 0)
        for ev in evaluated:
            self.assertFalse(ev['selected'])
            self.assertIsNotNone(ev['rejection_reason'])

    # ── Test 14: No-Context Gate Activates on Non-Existent Feature ─────────────
    @patch('rag.services.search_code', return_value=[])
    @patch('rag.services.call_gemini')
    def test_no_context_guard_on_missing_feature(self, mock_gemini, mock_search):
        result = handle_chat(
            user=self.user,
            repository_id=self.repo.id,
            message="Where is Stripe payment processing implemented?"
        )
        mock_gemini.assert_not_called()
        self.assertIn("couldn't find enough relevant information", result['answer'])
        self.assertEqual(result['sources'], [])

    # ── Test 15: Answer Validator Intercepts Hallucinated File ────────────────
    def test_answer_validator_intercepts_hallucinated_file(self):
        answer = "Stripe payments are implemented in `backend/payments/stripe_handler.py`."
        context_chunks = [
            {'file_path': 'backend/auth/views.py', 'symbol_name': 'GoogleAuthView'},
        ]
        is_valid, final_answer, errors = validate_answer(answer, context_chunks)
        self.assertFalse(is_valid)
        self.assertIn("couldn't find enough verified evidence", final_answer)
        self.assertTrue(any('stripe_handler.py' in err for err in errors))

    # ── Test 16: Answer Validator Accepts Grounded Answer ─────────────────────
    def test_answer_validator_accepts_grounded_answer(self):
        answer = "Google authentication is handled by `GoogleAuthView` in `backend/auth/views.py`."
        context_chunks = [
            {'file_path': 'backend/auth/views.py', 'symbol_name': 'GoogleAuthView.post'},
        ]
        is_valid, final_answer, errors = validate_answer(answer, context_chunks)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])
        self.assertEqual(final_answer, answer)

    # ── Test 17: "when was the last commit?" ──────────────────────────────────
    def test_query_when_was_the_last_commit(self):
        # Create a newer commit than auth (Feb) and redis (March)
        latest_commit = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='9999999a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e',
            author_name='Charlie Maintainer',
            author_email='charlie@example.com',
            committed_date=datetime(2026, 4, 20, 10, 0, 0, tzinfo=timezone.utc),
            message='docs: comprehensive API documentation and release notes',
            files_changed=[{'filename': 'README.md', 'status': 'modified', 'additions': 50, 'deletions': 2}],
            stats={'total_additions': 50, 'total_deletions': 2, 'files_changed_count': 1},
            embedding=[0.08] * 384,
            embedding_text='docs API documentation release notes Charlie Maintainer',
        )
        q = "when was the last commit?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        chunks = search_code(self.repo.id, q, top_k=5)
        self.assertGreater(len(chunks), 0)
        top = chunks[0]
        self.assertEqual(top['symbol_type'], 'commit')
        self.assertEqual(top['commit_sha'], latest_commit.commit_sha)
        self.assertIn('2026-04-20', top['committed_date'])

    # ── Test 18: "what was the latest commit?" ────────────────────────────────
    def test_query_what_was_the_latest_commit(self):
        latest = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='8888888a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e',
            author_name='Diana Lead',
            author_email='diana@example.com',
            committed_date=datetime(2026, 5, 1, 16, 45, 0, tzinfo=timezone.utc),
            message='feat: add real-time WebSocket notifications',
            files_changed=[{'filename': 'backend/ws/consumers.py', 'status': 'added', 'additions': 60, 'deletions': 0}],
            stats={'total_additions': 60, 'total_deletions': 0, 'files_changed_count': 1},
            embedding=[0.06] * 384,
            embedding_text='feat add real-time WebSocket notifications Diana Lead',
        )
        q = "what was the latest commit?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        chunks = search_code(self.repo.id, q, top_k=3)
        self.assertGreater(len(chunks), 0)
        top = chunks[0]
        self.assertEqual(top['commit_sha'], latest.commit_sha)
        self.assertIn('WebSocket notifications', top['content'])

    # ── Test 19: "who made the last commit?" ──────────────────────────────────
    def test_query_who_made_the_last_commit(self):
        latest = CommitMemory.objects.create(
            repository=self.repo,
            commit_sha='7777777a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e',
            author_name='Evan Engineer',
            author_email='evan@example.com',
            committed_date=datetime(2026, 5, 10, 11, 0, 0, tzinfo=timezone.utc),
            message='fix: resolve memory leak in background worker',
            files_changed=[{'filename': 'backend/tasks.py', 'status': 'modified', 'additions': 5, 'deletions': 3}],
            stats={'total_additions': 5, 'total_deletions': 3, 'files_changed_count': 1},
            embedding=[0.07] * 384,
            embedding_text='fix resolve memory leak in background worker Evan Engineer',
        )
        q = "who made the last commit?"
        chunks = search_code(self.repo.id, q, top_k=3)
        self.assertGreater(len(chunks), 0)
        top = chunks[0]
        self.assertEqual(top['author_name'], 'Evan Engineer')
        self.assertEqual(top['commit_sha'], latest.commit_sha)

    # ── Test 20: "when was commit X?" ─────────────────────────────────────────
    def test_query_when_was_commit_x(self):
        q = f"when was commit {self.commit_auth.commit_sha[:8]}?"
        self.assertEqual(detect_query_type(q), QueryType.HISTORY)

        chunks = search_code(self.repo.id, q, top_k=3)
        self.assertGreater(len(chunks), 0)
        top = chunks[0]
        self.assertEqual(top['commit_sha'], self.commit_auth.commit_sha)
        self.assertIn('2026-02-15', top['committed_date'])

    # ── Test 21: Retrieval of an older commit ─────────────────────────────────
    def test_retrieval_of_an_older_commit(self):
        # Even with newer commits present, querying specifically for Redis history retrieves the older Redis commit
        q = "why was Redis introduced and in which commit?"
        chunks = search_code(self.repo.id, q, top_k=3)
        self.assertGreater(len(chunks), 0)
        commit_chunks = [c for c in chunks if c.get('symbol_type') == 'commit']
        self.assertGreater(len(commit_chunks), 0)
        redis_found = any(c['commit_sha'] == self.commit_redis.commit_sha for c in commit_chunks)
        self.assertTrue(redis_found)

    # ── Test 22: Repository Isolation for Commit Queries ──────────────────────
    def test_repository_isolation_for_commit_queries(self):
        other_repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/other/project',
            name='project',
            owner='other',
            is_indexed=True,
            status=Repository.Status.SUCCESS,
        )
        other_commit = CommitMemory.objects.create(
            repository=other_repo,
            commit_sha='9999999999999999999999999999999999999999',
            author_name='Other Guy',
            author_email='other@example.com',
            committed_date=datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc),  # Much newer
            message='Secret commit for other repo',
            files_changed=[],
            stats={},
            embedding=[0.05] * 384,
            embedding_text='Secret commit for other repo Other Guy',
        )

        chunks = search_code(self.repo.id, "what was the latest commit?", top_k=5)
        # other_repo's commit MUST NOT be present in self.repo's search results
        for c in chunks:
            if c.get('symbol_type') == 'commit':
                self.assertNotEqual(c.get('commit_sha'), other_commit.commit_sha)

    # ── Test 23: Empty CommitMemory returns clear unindexed message ────────────
    @patch('rag.services.call_gemini')
    def test_empty_commit_memory_returns_clear_message(self, mock_gemini):
        empty_repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/empty/repo',
            name='empty-repo',
            owner='empty',
            is_indexed=True,
            status=Repository.Status.SUCCESS,
        )
        result = handle_chat(
            user=self.user,
            repository_id=empty_repo.id,
            message="when was the last commit and what was it",
        )
        # Gemini must NOT be called to prevent hallucination
        mock_gemini.assert_not_called()
        self.assertIn("Commit history has not been indexed", result['answer'])
        self.assertEqual(result['sources'], [])

    # ── Test 24: Overview Retrieval Returns README and Manifests ──────────────
    def test_overview_retrieval_returns_readme_and_manifests(self):
        chunks = search_code(self.repo.id, "what is this repo about?", top_k=5)
        self.assertGreater(len(chunks), 0)
        file_paths = [c['file_path'] for c in chunks]
        self.assertIn('README.md', file_paths)
        self.assertIn('package.json', file_paths)

    # ── Test 25: Authentication Implementation Retrieval ─────────────────────
    def test_authentication_implementation_retrieval(self):
        chunks = search_code(self.repo.id, "where is authentication implemented?", top_k=5)
        self.assertGreater(len(chunks), 0)
        top = chunks[0]
        self.assertIn(top['file_path'], ('backend/auth/views.py', 'backend/auth/jwt_service.py'))
        self.assertIn(top['symbol_name'], ('GoogleAuthView.post', 'JWTService.generate_token'))

    # ── Test 26: Main Application Logic Outranks CSS and Generic Utilities ──
    def test_main_application_logic_outranks_css_and_generic_utilities(self):
        accepted, evaluated = search_code(self.repo.id, "where is the main logic code present?", top_k=5, return_all_evaluated=True)
        self.assertGreater(len(accepted), 0)
        accepted_paths = [c['file_path'] for c in accepted]
        # backend/main.py must be present in accepted results
        self.assertIn('backend/main.py', accepted_paths)
        # frontend/src/index.css and assets/js/main.js must NOT be present in accepted results
        self.assertNotIn('frontend/src/index.css', accepted_paths)
        self.assertNotIn('assets/js/main.js', accepted_paths)

    # ── Test 27: Feature Existence Questions — Presence ───────────────────────
    def test_feature_existence_presence(self):
        chunks = search_code(self.repo.id, "is authentication used in this repo?", top_k=5)
        self.assertGreater(len(chunks), 0)
        file_paths = [c['file_path'] for c in chunks]
        # Must retrieve actual auth implementation code
        self.assertTrue(any('auth' in p for p in file_paths))

    # ── Test 28: Feature Existence Questions — Absence & Manifest Evidence ────
    @patch('rag.services.call_gemini')
    def test_feature_existence_absence_and_no_context_behavior(self, mock_gemini):
        no_auth_repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/clean/no-auth-project',
            name='NoAuthProject',
            owner='clean-team',
            is_indexed=True,
            status=Repository.Status.SUCCESS,
        )
        # Add manifest with no auth dependencies
        CodeChunk.objects.create(
            repository=no_auth_repo,
            file_path='package.json',
            symbol_name='dependencies',
            symbol_type='module',
            start_line=1,
            end_line=15,
            content='{\n  "name": "simple-calc",\n  "dependencies": {\n    "mathjs": "^11.0.0"\n  }\n}',
            embedding=[0.02] * 384,
            embedding_text='simple calc mathjs dependencies package.json',
        )

        # 1. Implementation question on repo with no auth must return 0 chunks and trigger no-context guard
        result = handle_chat(
            user=self.user,
            repository_id=no_auth_repo.id,
            message="where is authentication implemented?",
        )
        mock_gemini.assert_not_called()
        self.assertIn("couldn't find enough relevant information", result['answer'])
        self.assertEqual(result['sources'], [])

    # ── Test 29: Repository Isolation for Code Chunks ─────────────────────────
    def test_repository_isolation_for_code_chunks(self):
        other_repo = Repository.objects.create(
            user=self.user,
            url='https://github.com/secret/isolated-repo',
            name='IsolatedRepo',
            owner='secret-team',
            is_indexed=True,
            status=Repository.Status.SUCCESS,
        )
        CodeChunk.objects.create(
            repository=other_repo,
            file_path='secret/isolated_auth.py',
            symbol_name='SecretAuthManager',
            symbol_type='class',
            start_line=1,
            end_line=30,
            content='class SecretAuthManager:\n    def authenticate(self): pass',
            embedding=[0.05] * 384,
            embedding_text='SecretAuthManager secret isolated authenticate auth',
        )

        chunks = search_code(self.repo.id, "where is authentication implemented?", top_k=10)
        retrieved_paths = [c['file_path'] for c in chunks]
        self.assertNotIn('secret/isolated_auth.py', retrieved_paths)

    # ── Test 30: Prevention of Irrelevant Utility Files Outranking Code ────────
    def test_prevention_of_irrelevant_utilities_outranking_code(self):
        accepted, evaluated = search_code(self.repo.id, "where is authentication implemented?", top_k=5, return_all_evaluated=True)
        self.assertGreater(len(accepted), 0)
        accepted_paths = [c['file_path'] for c in accepted]

        # Passive utilities (scripts/spatial_enrich.py, backend/utils/logger.py, frontend/src/index.css, assets/js/main.js)
        # must NOT outrank real auth implementations
        self.assertNotIn('scripts/spatial_enrich.py', accepted_paths)
        self.assertNotIn('backend/utils/logger.py', accepted_paths)
        self.assertNotIn('frontend/src/index.css', accepted_paths)
        self.assertNotIn('assets/js/main.js', accepted_paths)
        self.assertIn('backend/auth/views.py', accepted_paths)

