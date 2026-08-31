"""
RAG Evaluation Suite (Phase 2.1).

Provides:
1. A benchmark question set with expected files/symbols per question.
2. compute_recall_at_k(): measures whether expected chunks appear in top-K results.
3. compute_mrr(): Mean Reciprocal Rank of expected chunks in results.
4. evaluate_retrieval(): runs the full benchmark and returns a summary dict.

Design principles:
- Evaluates retrieval INDEPENDENTLY from Gemini (no LLM API calls).
- Uses the real search_code() pipeline (hybrid retrieval + reranker).
- Expected targets are file path substrings and/or symbol name substrings.
  A chunk "matches" if it contains ANY expected target in its file path or symbol name.
- Can be run programmatically or via the Django management command.

Usage:
    from rag.eval_suite import evaluate_retrieval
    results = evaluate_retrieval(repository_id=7)
    print(results)
"""

import logging
from typing import Optional

from embeddings.knowledge_service import search_code

logger = logging.getLogger(__name__)


# ─── Benchmark Question Set ────────────────────────────────────────────────────
# Each entry:
#   question: str — the natural language query
#   expected: list[str] — file path substrings or symbol name substrings that
#             MUST appear in the top retrieved chunks for the answer to be correct.
#   category: str — for grouping results in reports

BENCHMARK_QUESTIONS: list[dict] = [
    # ─ Authentication
    {
        'question': 'Where is Google login implemented?',
        'expected': ['google', 'auth', 'login'],
        'category': 'authentication',
    },
    {
        'question': 'How does JWT token generation work?',
        'expected': ['token', 'jwt', 'generate'],
        'category': 'authentication',
    },
    {
        'question': 'Where is user authentication handled?',
        'expected': ['auth', 'user', 'login'],
        'category': 'authentication',
    },
    {
        'question': 'Which view handles Google OAuth callback?',
        'expected': ['google', 'oauth', 'auth'],
        'category': 'authentication',
    },

    # ─ Repository management
    {
        'question': 'Where is the Repository model defined?',
        'expected': ['repositories/models', 'Repository'],
        'category': 'repository_management',
    },
    {
        'question': 'How is repository indexing triggered?',
        'expected': ['index', 'repositories'],
        'category': 'repository_management',
    },
    {
        'question': 'Which API endpoint handles repository analysis?',
        'expected': ['analyse', 'repositories', 'views'],
        'category': 'repository_management',
    },
    {
        'question': 'Where is repository cloning implemented?',
        'expected': ['clone', 'repositories'],
        'category': 'repository_management',
    },

    # ─ AI Chat / RAG
    {
        'question': 'Which files are responsible for AI chat?',
        'expected': ['chat', 'rag', 'views'],
        'category': 'ai_chat',
    },
    {
        'question': 'Where are ChatSession and ChatMessage models defined?',
        'expected': ['chat_models', 'ChatSession', 'ChatMessage'],
        'category': 'ai_chat',
    },
    {
        'question': 'Which API handles repository chat requests?',
        'expected': ['chat', 'views', 'repositories'],
        'category': 'ai_chat',
    },
    {
        'question': 'How does the RAG pipeline work?',
        'expected': ['rag/services', 'handle_chat'],
        'category': 'ai_chat',
    },

    # ─ Embeddings
    {
        'question': 'Where are code embeddings generated?',
        'expected': ['embedding_service', 'embeddings'],
        'category': 'embeddings',
    },
    {
        'question': 'How is vector similarity search done?',
        'expected': ['knowledge_service', 'search_code', 'cosine'],
        'category': 'embeddings',
    },
    {
        'question': 'Where is the CodeChunk model defined?',
        'expected': ['embeddings/models', 'CodeChunk'],
        'category': 'embeddings',
    },

    # ─ Code parsing
    {
        'question': 'How is the repository code chunked for indexing?',
        'expected': ['chunker', 'chunk_repository'],
        'category': 'parsing',
    },
    {
        'question': 'Which parser is used for Python files?',
        'expected': ['chunker', 'tree_sitter', 'python'],
        'category': 'parsing',
    },

    # ─ Configuration
    {
        'question': 'Where is the database configuration?',
        'expected': ['settings', 'database', 'postgres'],
        'category': 'configuration',
    },
    {
        'question': 'How is PostgreSQL configured?',
        'expected': ['settings', 'postgresql', 'postgres'],
        'category': 'configuration',
    },
    {
        'question': 'Where are Django apps registered?',
        'expected': ['settings', 'installed_apps', 'apps'],
        'category': 'configuration',
    },

    # ─ Repository Overview
    {
        'question': 'What is this repository about?',
        'expected': ['readme', 'agents', 'architecture', 'package.json', 'pyproject.toml'],
        'category': 'overview',
    },
    {
        'question': 'Project overview and architecture',
        'expected': ['readme', 'agents', 'architecture', 'app', 'main'],
        'category': 'overview',
    },

    # ─ Components & UI
    {
        'question': 'Where is the map component?',
        'expected': ['map', 'mapview', 'mapcontrols'],
        'category': 'components',
    },
    {
        'question': 'Which file handles map controls?',
        'expected': ['mapcontrols', 'map'],
        'category': 'components',
    },
]


# ─── Matching ──────────────────────────────────────────────────────────────────

def _chunk_matches(chunk: dict, expected_targets: list[str]) -> bool:
    """
    Return True if this chunk is "relevant" to the question —
    i.e., its file_path or symbol_name contains at least one expected target.
    Matching is case-insensitive and substring-based.
    """
    file_path   = chunk.get('file_path', '').lower()
    symbol_name = chunk.get('symbol_name', '').lower()
    class_name  = chunk.get('class_name', '').lower()
    content     = chunk.get('content', '').lower()

    for target in expected_targets:
        t = target.lower()
        if t in file_path or t in symbol_name or t in class_name:
            return True
        # Also check content for very specific identifiers
        if len(t) >= 6 and t in content:
            return True

    return False


def _first_hit_rank(chunks: list[dict], expected_targets: list[str]) -> Optional[int]:
    """Return the 1-indexed rank of the first relevant chunk, or None if not found."""
    for i, chunk in enumerate(chunks):
        if _chunk_matches(chunk, expected_targets):
            return i + 1
    return None


# ─── Metrics ───────────────────────────────────────────────────────────────────

def compute_recall_at_k(results: list[dict], k: int) -> float:
    """
    Recall@K: fraction of queries where at least one expected chunk appeared
    in the top-K retrieved results.

    Args:
        results: List of per-query result dicts from evaluate_retrieval().
        k: Cut-off rank.

    Returns:
        Recall@K ∈ [0.0, 1.0]
    """
    if not results:
        return 0.0
    hits = sum(
        1 for r in results
        if r['first_hit_rank'] is not None and r['first_hit_rank'] <= k
    )
    return hits / len(results)


def compute_mrr(results: list[dict]) -> float:
    """
    Mean Reciprocal Rank: average of 1/rank for each query where a relevant
    chunk was found. Queries with no hits contribute 0.

    Args:
        results: List of per-query result dicts from evaluate_retrieval().

    Returns:
        MRR ∈ [0.0, 1.0]
    """
    if not results:
        return 0.0
    total = sum(
        1.0 / r['first_hit_rank']
        if r['first_hit_rank'] is not None else 0.0
        for r in results
    )
    return total / len(results)


# ─── Full Evaluation ───────────────────────────────────────────────────────────

def evaluate_retrieval(
    repository_id: int,
    questions: Optional[list[dict]] = None,
    top_k_eval: int = 10,
) -> dict:
    """
    Run the retrieval evaluation benchmark against a real indexed repository.

    This calls search_code() (hybrid retrieval + reranker) — no Gemini API calls.

    Args:
        repository_id: ID of an indexed repository to run queries against.
        questions: Optional custom question list (defaults to BENCHMARK_QUESTIONS).
        top_k_eval: Number of chunks to retrieve per question for evaluation
                    (should be >= RAG_CONTEXT_TOP_K; default 10).

    Returns:
        {
            'total_questions': int,
            'recall_at_5': float,
            'recall_at_10': float,
            'mrr': float,
            'per_question': [
                {
                    'question': str,
                    'category': str,
                    'expected': list[str],
                    'first_hit_rank': int|None,
                    'top_chunks': list[str],  # file_path of top-5 retrieved
                }
            ]
        }
    """
    from embeddings.knowledge_service import search_code

    questions = questions or BENCHMARK_QUESTIONS
    per_question_results = []

    for q in questions:
        query   = q['question']
        targets = q['expected']

        try:
            chunks = search_code(
                repository_id=repository_id,
                query_text=query,
                top_k=top_k_eval,
            )
        except Exception as exc:
            logger.warning('eval_suite: retrieval failed for "%s": %s', query, exc)
            chunks = []

        rank = _first_hit_rank(chunks, targets)

        per_question_results.append({
            'question':       query,
            'category':       q.get('category', ''),
            'expected':       targets,
            'first_hit_rank': rank,
            'top_chunks':     [c.get('file_path', '') for c in chunks[:5]],
            'top_symbols':    [c.get('symbol_name', '') for c in chunks[:5]],
            'top_scores':     [round(c.get('final_score', c.get('similarity', 0)), 4) for c in chunks[:5]],
        })

    recall_5  = compute_recall_at_k(per_question_results, k=5)
    recall_10 = compute_recall_at_k(per_question_results, k=10)
    mrr       = compute_mrr(per_question_results)

    return {
        'total_questions': len(questions),
        'recall_at_5':     round(recall_5, 4),
        'recall_at_10':    round(recall_10, 4),
        'mrr':             round(mrr, 4),
        'per_question':    per_question_results,
    }
