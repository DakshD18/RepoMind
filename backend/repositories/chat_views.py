"""
Chat Views (Phase 2) — Thin Django REST views.

All RAG logic lives in rag.services. Views only handle:
- Authentication/permission validation (via DRF IsAuthenticated)
- Request deserialization
- Error mapping to HTTP status codes
- Response serialization
"""

import logging
import threading

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from repositories.models import Repository, ChatSession
from repositories.chat_serializers import (
    ChatRequestSerializer,
    ChatSessionSerializer,
    ChatSessionListSerializer,
)
from embeddings.knowledge_service import index_repository

logger = logging.getLogger(__name__)


def _get_user_repository(pk: int, user):
    """Retrieve a repository that belongs to the user, or return None."""
    try:
        return Repository.objects.get(pk=pk, user=user)
    except Repository.DoesNotExist:
        return None


# ── Indexing ─────────────────────────────────────────────────────────────────

class IndexRepositoryView(APIView):
    """
    POST /api/repositories/<id>/index/

    Triggers indexing of the repository in a background thread.
    Returns immediately with 202 Accepted.

    The frontend should poll the repository detail endpoint and check
    repository.index_status / repository.is_indexed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)

        if repo.status != Repository.Status.SUCCESS:
            return Response(
                {'error': 'Repository must be successfully cloned before it can be indexed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if repo.index_status == 'indexing':
            return Response(
                {'message': 'Repository is already being indexed.'},
                status=status.HTTP_202_ACCEPTED,
            )

        # Run indexing in a background thread so the request returns immediately
        def run_index():
            try:
                index_repository(repo)
            except Exception as exc:
                logger.error('Background indexing failed for repo %d: %s', repo.id, exc)

        thread = threading.Thread(target=run_index, daemon=True)
        thread.start()

        return Response(
            {
                'message': 'Indexing started. Check repository status to track progress.',
                'index_status': 'indexing',
            },
            status=status.HTTP_202_ACCEPTED,
        )


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatView(APIView):
    """
    POST /api/repositories/<id>/chat/

    Send a natural-language question about the repository.
    Returns the AI answer plus source code references.

    Will return 409 if repository is not indexed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        session_id = serializer.validated_data.get('session_id')
        debug = serializer.validated_data.get('debug', False)

        from rag.services import handle_chat, RepositoryNotIndexedError, RepositoryNotFoundError

        try:
            result = handle_chat(
                user=request.user,
                repository_id=pk,
                message=message,
                session_id=session_id,
                debug=debug,
            )
            return Response(result, status=status.HTTP_200_OK)

        except RepositoryNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        except RepositoryNotIndexedError as e:
            return Response(
                {
                    'error': str(e),
                    'code': 'not_indexed',
                    'index_status': repo.index_status,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except RuntimeError as e:
            # Gemini errors, embedding errors — user-safe message, no stack traces
            logger.error('Chat runtime error for repo %d: %s', pk, e)
            err_msg = str(e)
            err_lower = err_msg.lower()
            if any(term in err_lower for term in ['503', 'unavailable', 'high demand', 'capacity', 'overloaded']):
                safe_message = 'The AI model is currently experiencing high demand from Google. Please wait a few moments and try your question again.'
            elif any(term in err_lower for term in ['429', 'rate limit', 'quota', 'resource_exhausted']):
                safe_message = 'AI rate limit reached. Please wait a moment before sending another message.'
            else:
                safe_message = err_msg
            return Response(
                {'error': safe_message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        except Exception as e:
            logger.exception('Unexpected error in ChatView for repo %d', pk)
            return Response(
                {'error': 'An unexpected error occurred. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ── Session management ────────────────────────────────────────────────────────

class ChatSessionListView(APIView):
    """
    GET  /api/repositories/<id>/sessions/   — list all sessions for repo
    POST /api/repositories/<id>/sessions/   — create a new session
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)

        sessions = ChatSession.objects.filter(repository=repo, user=request.user)
        serializer = ChatSessionListSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)

        title = request.data.get('title', 'New Chat')
        session = ChatSession.objects.create(
            user=request.user,
            repository=repo,
            title=title,
        )
        serializer = ChatSessionListSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatSessionDetailView(APIView):
    """
    GET    /api/repositories/<id>/sessions/<session_id>/  — retrieve session + messages
    DELETE /api/repositories/<id>/sessions/<session_id>/  — delete session
    """
    permission_classes = [IsAuthenticated]

    def _get_session(self, pk, session_id, user):
        repo = _get_user_repository(pk, user)
        if not repo:
            return None, None
        try:
            session = ChatSession.objects.get(pk=session_id, repository=repo, user=user)
            return repo, session
        except ChatSession.DoesNotExist:
            return repo, None

    def get(self, request, pk, session_id):
        repo, session = self._get_session(pk, session_id, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not session:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk, session_id):
        repo, session = self._get_session(pk, session_id, request.user)
        if not repo:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not session:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
