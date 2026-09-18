"""
RAG Service (Phase 2.1 — RAG Accuracy Upgrade).

Phase 2.1 improvements over Phase 2:
1. Hybrid retrieval: semantic vector + keyword/identifier search.
2. Two-stage: retrieve 15-20 candidates → rerank → best 6-10 for Gemini.
3. Query processor: enriches follow-up queries with context from conversation history.
4. No-context threshold: if top candidate score is below RAG_NO_CONTEXT_THRESHOLD,
   skip Gemini and return a clear "insufficient context" message.
5. Enriched debug mode: includes semantic_score, keyword_score, identifier_score,
   path_score, final_score for each chunk.
6. Conversation history is used for follow-up query enrichment (Step 3b),
   while repository retrieval always runs fresh every turn.

The pipeline:
    User Question + Conversation History
            ↓
    Query Processor (enrich follow-up pronouns)
            ↓
    Hybrid Retrieval (vector + keyword, 15–20 candidates)
            ↓
    Reranker (semantic + keyword + identifier + path → top 6–10)
            ↓
    Context Builder (structured SOURCE N blocks, deduplication)
            ↓
    Gemini (strictly grounded)
            ↓
    Answer + Source Citations

Note: NEVER auto-indexes. If repository is not indexed, raises RepositoryNotIndexedError.
"""

import logging
import os
from typing import Optional

from repositories.models import Repository, ChatSession, ChatMessage
from embeddings.knowledge_service import search_code, RAG_CONTEXT_TOP_K
from rag.context_builder import build_context, format_sources
from rag.llm_service import call_gemini
from rag.query_processor import build_retrieval_query
from rag.reranker import detect_query_type, QueryType
from rag.validator import validate_answer

logger = logging.getLogger(__name__)

# Max previous conversation turns sent to Gemini (keeps context compact)
MAX_HISTORY_TURNS = 6

# If the top reranked chunk's final_score is below this, skip Gemini
RAG_NO_CONTEXT_THRESHOLD = float(os.getenv('RAG_NO_CONTEXT_THRESHOLD', '0.25'))


class RepositoryNotIndexedError(Exception):
    """Raised when a chat query is attempted on an un-indexed repository."""
    pass


class RepositoryNotFoundError(Exception):
    """Raised when the user doesn't own the repository or it doesn't exist."""
    pass


def _get_conversation_history(session: ChatSession) -> list[dict]:
    """
    Convert the last N ChatMessage turns into the Gemini format:
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
    Main entry point for the RAG chat pipeline (Phase 2.1).

    Args:
        user: Authenticated Django User.
        repository_id: ID of the repository to query.
        message: The user's natural-language question.
        session_id: Optional existing ChatSession ID to continue.
        debug: If True, include retrieval scoring details in the response.

    Returns:
        Dict with: session_id, title, message_id, answer, sources
        (optionally: debug_chunks if debug=True)

    Raises:
        RepositoryNotFoundError: Repository not found or not owned by user.
        RepositoryNotIndexedError: Repository hasn't been indexed yet.
        RuntimeError: Gemini failure.
    """

    # ── 1. Validate repository ownership ─────────────────────────────────────
    try:
        repository = Repository.objects.get(pk=repository_id, user=user)
    except Repository.DoesNotExist:
        raise RepositoryNotFoundError(f'Repository {repository_id} not found.')

    if not repository.is_indexed:
        raise RepositoryNotIndexedError(
            f'Repository "{repository.name}" is not indexed yet. '
            'Use the Index button to start indexing before chatting.'
        )

    # ── 2. Retrieve or create ChatSession ────────────────────────────────────
    if session_id:
        try:
            session = ChatSession.objects.get(
                pk=session_id, user=user, repository=repository
            )
        except ChatSession.DoesNotExist:
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

    # ── 3. Persist user message ──────────────────────────────────────────────
    ChatMessage.objects.create(
        session=session,
        role=ChatMessage.ROLE_USER,
        content=message,
    )

    # ── 3b. Get conversation history (before this user turn) ─────────────────
    # Used for (a) follow-up query enrichment and (b) Gemini conversation context.
    history = _get_conversation_history(session)
    # Remove the last message we just persisted (current user turn)
    if history and history[-1]['role'] == 'user':
        history = history[:-1]

    # ── 4. Query Processing — enrich follow-up queries ───────────────────────
    query_type = detect_query_type(message)
    retrieval_query = build_retrieval_query(message, history)

    # For HISTORY queries: verify if CommitMemory has been indexed for this repository
    commit_memory_count = 0
    if query_type == QueryType.HISTORY:
        from memory.models import CommitMemory
        commit_memory_count = CommitMemory.objects.filter(repository=repository).count()
        if commit_memory_count == 0:
            no_commits_answer = (
                f'Commit history has not been indexed for repository "{repository.name}". '
                'Please re-index the repository to fetch and analyze git commit history.'
            )
            assistant_msg = ChatMessage.objects.create(
                session=session,
                role=ChatMessage.ROLE_ASSISTANT,
                content=no_commits_answer,
                sources=[],
            )
            if session.title == 'New Chat':
                session.title = _auto_title_from_question(message)
                session.save(update_fields=['title'])

            logger.info(
                'HISTORY RETRIEVAL DEBUG:\n'
                '  - repository ID: %d\n'
                '  - number of CommitMemory records: 0\n'
                '  - query type: %s\n'
                '  - number of commit candidates: 0\n'
                '  - top commit SHAs: []\n'
                '  - similarity scores: []\n'
                '  - reranked scores: []\n'
                '  - whether the no-context guard triggered: True (empty CommitMemory)\n'
                '  - final context length: 0',
                repository_id, query_type,
            )

            result = {
                'session_id': session.id,
                'title': session.title,
                'message_id': assistant_msg.id,
                'answer': no_commits_answer,
                'sources': [],
            }
            if debug:
                result['retrieval_query'] = retrieval_query
                result['query_type'] = query_type
            return result

    # ── 5. Hybrid Retrieval + Reranking (repository-scoped) ──────────────────
    res = search_code(
        repository_id=repository_id,
        query_text=retrieval_query,
        top_k=RAG_CONTEXT_TOP_K,
        return_all_evaluated=True,
        return_retrieval_meta=True,
    )
    if isinstance(res, tuple) and len(res) == 3:
        chunks, all_evaluated, retrieval_meta = res
    elif isinstance(res, tuple) and len(res) == 2:
        chunks, all_evaluated = res
        retrieval_meta = {}
    else:
        chunks = res if isinstance(res, list) else []
        all_evaluated = res if isinstance(res, list) else []
        retrieval_meta = {}

    # ── 6. No-context handling ────────────────────────────────────────────────
    # If no chunks passed the absolute relevance gate or top chunk is below threshold, skip Gemini
    top_score = chunks[0].get('final_score', chunks[0].get('similarity', 0)) if chunks else 0
    no_context_guard_triggered = not chunks or top_score < RAG_NO_CONTEXT_THRESHOLD

    # Detailed stage-by-stage debug logging
    top_candidates_log = []
    for i, c in enumerate((all_evaluated or [])[:10]):
        status = "ACCEPTED" if c.get('selected') else f"REJECTED ({c.get('rejection_reason', 'below threshold')})"
        struct_sc = round(c.get('path_score', 0.0) + max(0.0, c.get('intent_score', 0.0)), 4)
        top_candidates_log.append(
            f"    [{i+1}] {c.get('file_path')} ({c.get('symbol_name')}) -> "
            f"final={c.get('final_score', 0.0):.3f}, sem={c.get('semantic_score', c.get('similarity', 0.0)):.3f}, "
            f"ident={c.get('identifier_score', 0.0):.3f}, struct={struct_sc:.3f} | {status}"
        )
    top_candidates_str = "\n".join(top_candidates_log) if top_candidates_log else "    (none)"

    logger.info(
        "RETRIEVAL PIPELINE STAGE DEBUG:\n"
        "  - Repository: %s (ID: %d)\n"
        "  - Query Type: %s\n"
        "  - User Query: %s\n"
        "  - Retrieval Query: %s\n"
        "  - Query Embedding: dims=%d, sample=%s\n"
        "  - Candidate Counts: semantic=%d, keyword=%d, commits=%d, structural=%d, total_merged=%d\n"
        "  - Top Evaluated Candidates (%d total):\n%s\n"
        "  - Final Gated Chunks Count: %d\n"
        "  - No-Context Guard Triggered: %s\n"
        "  - Gemini Called: %s",
        repository.name,
        repository_id,
        query_type,
        message,
        retrieval_query,
        len(retrieval_meta.get('query_vec', [])),
        [round(x, 4) for x in retrieval_meta.get('query_vec', [])[:4]],
        retrieval_meta.get('semantic_count', 0),
        retrieval_meta.get('keyword_count', 0),
        retrieval_meta.get('commit_count', 0),
        retrieval_meta.get('structural_count', 0),
        retrieval_meta.get('total_candidates', 0),
        len(all_evaluated or []),
        top_candidates_str,
        len(chunks),
        no_context_guard_triggered,
        not no_context_guard_triggered,
    )

    if no_context_guard_triggered:
        no_context_answer = (
            "I couldn't find enough relevant information in this repository's "
            "indexed code to answer that confidently. This can happen if:\n\n"
            "- The relevant files or commits haven't been indexed yet (try re-indexing).\n"
            "- The question refers to something outside the codebase "
            "(e.g. infrastructure, external services, or uncommitted work).\n"
            "- Try rephrasing with specific file names, class names, or function names."
        )
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_ASSISTANT,
            content=no_context_answer,
            sources=[],
        )
        if session.title == 'New Chat':
            session.title = _auto_title_from_question(message)
            session.save(update_fields=['title'])

        result = {
            'session_id': session.id,
            'title': session.title,
            'message_id': assistant_msg.id,
            'answer': no_context_answer,
            'sources': [],
        }
        if debug:
            result['debug_info'] = {
                'query_type': query_type,
                'query_embedding_dims': len(retrieval_meta.get('query_vec', [])),
                'query_embedding_sample': [round(x, 4) for x in retrieval_meta.get('query_vec', [])[:5]],
                'candidate_counts': {
                    'semantic': retrieval_meta.get('semantic_count', 0),
                    'keyword': retrieval_meta.get('keyword_count', 0),
                    'commits': retrieval_meta.get('commit_count', 0),
                    'structural': retrieval_meta.get('structural_count', 0),
                    'total_merged': retrieval_meta.get('total_candidates', 0),
                },
                'final_context_chunk_count': 0,
                'gemini_called': False,
            }
            result['debug_chunks'] = [
                {
                    'file_path':        c.get('file_path', ''),
                    'symbol_name':      c.get('symbol_name', ''),
                    'source_type':      c.get('symbol_type', 'code'),
                    'similarity':       round(c.get('semantic_score', c.get('similarity', 0)), 4),
                    'semantic_score':   round(c.get('semantic_score', c.get('similarity', 0)), 4),
                    'identifier_score': round(c.get('identifier_score', 0), 4),
                    'structural_score': round(c.get('path_score', 0.0) + max(0.0, c.get('intent_score', 0.0)), 4),
                    'keyword_score':    round(c.get('keyword_score', 0), 4),
                    'path_score':       round(c.get('path_score', 0), 4),
                    'intent_score':     round(c.get('intent_score', 0), 4),
                    'final_score':      round(c.get('final_score', c.get('similarity', 0)), 4),
                    'selected':         c.get('selected', False),
                    'rejection_reason': c.get('rejection_reason', 'below absolute relevance threshold'),
                }
                for c in (all_evaluated or [])
            ]
            result['retrieval_query'] = retrieval_query
            result['query_type'] = query_type
        return result

    # ── 7. Build structured context ───────────────────────────────────────────
    context = build_context(repository.name, chunks)

    # ── 8. Call Gemini (grounded) ─────────────────────────────────────────────
    raw_answer = call_gemini(
        system_context=context,
        conversation_history=history,
        user_question=message,
    )

    # ── 8b. Answer Validation Layer ───────────────────────────────────────────
    is_valid, answer, validation_errors = validate_answer(
        answer=raw_answer,
        context_chunks=chunks,
        query_type=query_type,
    )

    # ── 9. Format sources (only for validated answers) ────────────────────────
    if is_valid:
        sources = format_sources(chunks)
    else:
        logger.warning('Validation failed: %s; suppressing sources', validation_errors)
        sources = []

    # ── 10. Persist assistant message ─────────────────────────────────────────
    assistant_msg = ChatMessage.objects.create(
        session=session,
        role=ChatMessage.ROLE_ASSISTANT,
        content=answer,
        sources=sources,
    )

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

    # ── 11. Retrieval debug mode ───────────────────────────────────────────────
    if debug:
        result['debug_info'] = {
            'query_type': query_type,
            'query_embedding_dims': len(retrieval_meta.get('query_vec', [])),
            'query_embedding_sample': [round(x, 4) for x in retrieval_meta.get('query_vec', [])[:5]],
            'candidate_counts': {
                'semantic': retrieval_meta.get('semantic_count', 0),
                'keyword': retrieval_meta.get('keyword_count', 0),
                'commits': retrieval_meta.get('commit_count', 0),
                'structural': retrieval_meta.get('structural_count', 0),
                'total_merged': retrieval_meta.get('total_candidates', 0),
            },
            'final_context_chunk_count': len(chunks),
            'gemini_called': True,
        }
        result['debug_chunks'] = [
            {
                'file_path':        c.get('file_path', ''),
                'symbol_name':      c.get('symbol_name', ''),
                'source_type':      c.get('symbol_type', 'code'),
                'similarity':       round(c.get('semantic_score', c.get('similarity', 0)), 4),
                'semantic_score':   round(c.get('semantic_score', c.get('similarity', 0)), 4),
                'identifier_score': round(c.get('identifier_score', 0), 4),
                'structural_score': round(c.get('path_score', 0.0) + max(0.0, c.get('intent_score', 0.0)), 4),
                'keyword_score':    round(c.get('keyword_score', 0), 4),
                'path_score':       round(c.get('path_score', 0), 4),
                'intent_score':     round(c.get('intent_score', 0), 4),
                'final_score':      round(c.get('final_score', c.get('similarity', 0)), 4),
                'selected':         c.get('selected', True),
                'rejection_reason': c.get('rejection_reason', None),
            }
            for c in (all_evaluated or chunks)
        ]
        result['retrieval_query'] = retrieval_query
        result['query_type'] = query_type
        if not is_valid:
            result['validation_errors'] = validation_errors

    return result
