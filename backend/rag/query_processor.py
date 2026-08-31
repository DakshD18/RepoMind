"""
Query Processor (Phase 2.1 — RAG Accuracy Upgrade).

Responsibilities:
1. Enrich follow-up queries with context from recent conversation history so
   pronouns ("it", "that", "this") resolve correctly during retrieval.
   Example:
       History: "AuthService handles Google login"
       Follow-up: "How does it generate the token?"
       Enriched query: "How does AuthService generate the token?"

2. The ORIGINAL user question is still used verbatim for Gemini generation.
   The enriched query is ONLY used for the vector/keyword retrieval step.

This avoids the failure mode where vague follow-ups retrieve completely
irrelevant chunks because the pronoun has no embedding signal.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Pronouns that likely need resolution via conversation history
_PRONOUN_RE = re.compile(
    r'\b(it|this|that|they|them|those|its|their|the class|the function|the method|the file|the module)\b',
    re.IGNORECASE,
)

# How many recent messages we scan for entity names to resolve pronouns
_HISTORY_SCAN_TURNS = 2

# Min identifier length to extract from history
_MIN_IDENT_LEN = 4


def _extract_entities_from_history(history: list[dict]) -> list[str]:
    """
    Extract likely code identifiers from recent conversation history.
    Returns a list of candidate names (PascalCase, camelCase, snake_case).
    """
    recent = history[-(_HISTORY_SCAN_TURNS * 2):]
    entity_re = re.compile(r'\b([A-Z][a-zA-Z0-9]{3,}|[a-z][a-zA-Z0-9]{3,}_[a-zA-Z0-9]+)\b')
    entities = []
    for turn in recent:
        text = turn.get('parts', [''])[0] if turn.get('parts') else ''
        found = entity_re.findall(text)
        entities.extend(found)
    # Deduplicate, preserving order
    seen = set()
    result = []
    for e in entities:
        if e.lower() not in seen and len(e) >= _MIN_IDENT_LEN:
            seen.add(e.lower())
            result.append(e)
    return result


def build_retrieval_query(
    user_question: str,
    conversation_history: Optional[list[dict]] = None,
) -> str:
    """
    Build an enriched retrieval query from the user question + recent context.

    If the question contains unresolved pronouns AND conversation history provides
    likely entity names, append the entity names to the query so retrieval finds
    the correct chunks.

    The returned string is ONLY used for vector search and keyword matching.
    It is NOT shown to the user and NOT passed to Gemini as the user turn.

    Args:
        user_question: The verbatim user question.
        conversation_history: Recent conversation turns in Gemini format:
            [{'role': 'user'|'model', 'parts': [text]}, ...]

    Returns:
        An enriched query string for retrieval.
    """
    if not conversation_history:
        return user_question

    # Check if the question seems to reference something from context
    has_pronoun = bool(_PRONOUN_RE.search(user_question))
    question_len = len(user_question.split())

    # Short questions with pronouns (e.g. "how does it work?") need enrichment
    needs_enrichment = has_pronoun and question_len <= 12

    if not needs_enrichment:
        return user_question

    entities = _extract_entities_from_history(conversation_history)
    if not entities:
        return user_question

    # Append top-3 entities as hints for retrieval
    top_entities = entities[:3]
    enriched = f'{user_question} [{" ".join(top_entities)}]'
    logger.debug(
        'QueryProcessor: enriched follow-up "%s" → "%s"',
        user_question[:60], enriched[:80],
    )
    return enriched
