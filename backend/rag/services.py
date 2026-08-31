"""
RAG Service (Phase 2) — Repository Intelligence Core.

Orchestrates the full pipeline:
1. Validate repository ownership and indexed state.
2. Retrieve or create ChatSession.
3. Persist user ChatMessage.
4. Retrieve conversation history for context.
5. Embed the user's question.
6. Repository-scoped vector search for relevant code chunks.
7. Build structured context from chunks.
8. Call Gemini with conversation history + current question + retrieved context.
9. Persist assistant ChatMessage with answer + source references.
10. Return structured response payload.

Note: This service NEVER auto-indexes. If the repository is not indexed,
it raises a RepositoryNotIndexedError and the view returns HTTP 409.
"""

import logging
from typing import Optional

from repositories.models import Repository, ChatSession, ChatMessage
from embeddings.knowledge_service import search_code
from rag.context_builder import build_context, format_sources
from rag.llm_service import call_gemini

logger = logging.getLogger(__name__)

# Max previous conversation turns sent to Gemini (to keep context compact)
MAX_HISTORY_TURNS = 6


class RepositoryNotIndexedError(Exception):
    """Raised when a chat query is attempted on an un-indexed repository."""
    pass


class RepositoryNotFoundError(Exception):
    """Raised when the user doesn't own the repository."""
    pass


def _get_conversation_history(session: ChatSession) -> list[dict]:
    """
    Convert the last N ChatMessage turns into the format expected by Gemini:
        [{'role': 'user'|'model', 'parts': [text]}, ...]

    Note: Gemini uses 'model' for assistant role.
    """
    messages = session.messages.order_by('-created_at')[:MAX_HISTORY_TURNS * 2]
    messages = list(reversed(messages))

    history = []
    for msg in messages:
        gemini_role = 'model' if msg.role == ChatMessage.ROLE_ASSISTANT else 'user'
        history.append({
            'role': gemini_role,
            'parts': [msg.content],
        })
    return history


def _auto_title_from_question(question: str) -> str:
    """Generate a short session title from the first user question."""
    words = question.strip().split()
    title = ' '.join(words[:6])
    if len(words) > 6:
        title += '...'
    return title[:100]


def handle_chat(
    user,
    repository_id: int,
    message: str,
    session_id: Optional[int] = None,
    debug: bool = False,
) -> dict:
    """
    Main entry point for the RAG chat pipeline.

    Args:
        user: Authenticated Django User.
        repository_id: ID of the repository to query.
        message: The user's natural-language question.
        session_id: Optional existing ChatSession ID to continue.
        debug: If True, include retrieval debug info in the response.

    Returns:
        Dict with:
            session_id, title, message_id, answer, sources
            (optionally: debug_chunks if debug=True)

    Raises:
        RepositoryNotFoundError: If the repository doesn't exist or doesn't belong to user.
        RepositoryNotIndexedError: If the repository hasn't been indexed yet.
        RuntimeError: If Gemini fails.
    """
    # ── 1. Validate repository ownership ──────────────────────────────────────
    try:
        repository = Repository.objects.get(pk=repository_id, user=user)
    except Repository.DoesNotExist:
        raise RepositoryNotFoundError(f'Repository {repository_id} not found.')

    if not repository.is_indexed:
        raise RepositoryNotIndexedError(
            f'Repository "{repository.name}" is not indexed yet. '
            'Use the Index button to start indexing before chatting.'
        )

    # ── 2. Retrieve or create ChatSession ─────────────────────────────────────
    if session_id:
        try:
            session = ChatSession.objects.get(
                pk=session_id, user=user, repository=repository
            )
        except ChatSession.DoesNotExist:
            # Session doesn't exist or doesn't belong to user — create fresh one
            session = ChatSession.objects.create(
                user=user,
                repository=repository,
                title=_auto_title_from_question(message),
            )
    else:
        session = ChatSession.objects.create(
            user=user,
            repository=repository,
            title=_auto_title_from_question(message),
        )

    # ── 3. Persist user message ────────────────────────────────────────────────
    ChatMessage.objects.create(
        session=session,
        role=ChatMessage.ROLE_USER,
        content=message,
    )

    # ── 4. Get conversation history (for follow-up awareness) ─────────────────
    # History is retrieved BEFORE this turn so Gemini has prior context.
    # Repository retrieval still happens every turn — history alone is not enough.
    history = _get_conversation_history(session)
    # Remove the last message we just added (it's the current user turn)
    if history and history[-1]['role'] == 'user':
        history = history[:-1]

    # ── 5. Vector search — repository-scoped ──────────────────────────────────
    chunks = search_code(repository_id=repository_id, query_text=message, top_k=6)
    logger.info(
        'RAG: repo=%d  query="%s"  chunks_found=%d',
        repository_id, message[:60], len(chunks)
    )

    # ── 6. Handle no-context case ─────────────────────────────────────────────
    if not chunks:
        no_context_answer = (
            "I couldn't find enough relevant code in this repository to answer "
            "that confidently. Try rephrasing your question or asking about "
            "a specific file, function, or feature you know exists in the codebase."
        )
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_ASSISTANT,
            content=no_context_answer,
            sources=[],
        )
        # Update session title if it's still the default
        if session.title == 'New Chat':
            session.title = _auto_title_from_question(message)
            session.save(update_fields=['title'])

        return {
            'session_id': session.id,
            'title': session.title,
            'message_id': assistant_msg.id,
            'answer': no_context_answer,
            'sources': [],
        }

    # ── 7. Build structured context ───────────────────────────────────────────
    context = build_context(repository.name, chunks)

    # ── 8. Call Gemini ────────────────────────────────────────────────────────
    answer = call_gemini(
        system_context=context,
        conversation_history=history,
        user_question=message,
    )

    # ── 9. Format sources ─────────────────────────────────────────────────────
    sources = format_sources(chunks)

    # ── 10. Persist assistant message ─────────────────────────────────────────
    assistant_msg = ChatMessage.objects.create(
        session=session,
        role=ChatMessage.ROLE_ASSISTANT,
        content=answer,
        sources=sources,
    )

    # Update session title (from first user message) and updated_at
    if session.title == 'New Chat':
        session.title = _auto_title_from_question(message)
    session.save(update_fields=['title', 'updated_at'])

    result = {
        'session_id': session.id,
        'title': session.title,
        'message_id': assistant_msg.id,
        'answer': answer,
        'sources': sources,
    }

    # Retrieval debug mode — for dev/testing only, never enabled in production
    if debug:
        result['debug_chunks'] = [
            {
                'file_path': c['file_path'],
                'symbol_name': c.get('symbol_name', ''),
                'start_line': c.get('start_line', 0),
                'end_line': c.get('end_line', 0),
                'similarity': round(c.get('similarity', 0), 4),
            }
            for c in chunks
        ]

    return result
