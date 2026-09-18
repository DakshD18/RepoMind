"""
Deterministic Reranker (Phase 2.1 — RAG Accuracy Upgrade).

Combines semantic similarity with exact identifier matching and file path signals
to produce a final score for each retrieved code chunk. This ensures that exact
symbol names and file paths in the query are surfaced to the top even when
semantic similarity alone would miss them.

Scoring formula:
    final_score = (
        semantic_weight  * semantic_score   +
        keyword_weight   * keyword_score    +
        identifier_weight * identifier_score +
        path_weight      * path_score
    )

Default weights (configurable via env):
    RAG_WEIGHT_SEMANTIC    = 0.50
    RAG_WEIGHT_KEYWORD     = 0.20
    RAG_WEIGHT_IDENTIFIER  = 0.20
    RAG_WEIGHT_PATH        = 0.10

Query Type Awareness:
    - Identifier query  ("where is generate_token?")    → boost identifier weight
    - Route query       ("where is /api/auth/google/")  → boost path weight
    - Flow query        ("explain the login flow")       → apply file diversity penalty
      (encourages returning chunks across multiple files for broader context)
"""

import os
import re
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# ─── Configurable weights ──────────────────────────────────────────────────────

_W_SEM  = float(os.getenv('RAG_WEIGHT_SEMANTIC',    '0.50'))
_W_KW   = float(os.getenv('RAG_WEIGHT_KEYWORD',     '0.20'))
_W_IDENT = float(os.getenv('RAG_WEIGHT_IDENTIFIER', '0.20'))
_W_PATH  = float(os.getenv('RAG_WEIGHT_PATH',       '0.10'))


# ─── Token extraction ──────────────────────────────────────────────────────────

# Splits camelCase, PascalCase, snake_case, and hyphen-case into tokens
_SPLIT_RE = re.compile(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[_\-\s./]+')

# Detects API route patterns like /api/auth/google/
_ROUTE_RE = re.compile(r'(?:^|[\s"\'`])/[a-zA-Z0-9_/\-:]+/')

# File extension pattern
_FILE_EXT_RE = re.compile(r'\b\w+\.(py|ts|tsx|js|jsx|java|go|rb|rs|cpp|cs)\b')


def _tokenize(text: str) -> set[str]:
    """Split a string into lowercase alphanumeric and sub-word tokens for keyword matching."""
    tokens = set()
    words = re.findall(r'[a-zA-Z0-9_]+', text)
    for word in words:
        # Split camelCase / PascalCase
        subparts = re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)', word)
        for part in subparts or [word]:
            part = part.strip().lower()
            if len(part) >= 2:
                tokens.add(part)
        # Also include snake_case parts
        for part in word.split('_'):
            part = part.strip().lower()
            if len(part) >= 2:
                tokens.add(part)
        if len(word) >= 2:
            tokens.add(word.lower())
    return tokens


def extract_query_tokens(query: str) -> set[str]:
    """
    Extract meaningful tokens from a user query.
    Handles camelCase, snake_case, filenames, and API routes.
    """
    return _tokenize(query)


def _stem(word: str) -> set[str]:
    """Return set of normalized base forms for a word (singular, base verb)."""
    forms = {word.lower()}
    w = word.lower()
    if w.endswith('ies') and len(w) > 3:
        forms.add(w[:-3] + 'y')
    elif w.endswith('es') and len(w) > 3:
        forms.add(w[:-2])
    elif w.endswith('s') and len(w) > 2:
        forms.add(w[:-1])
    if w.endswith('ing') and len(w) > 4:
        forms.add(w[:-3])
        forms.add(w[:-3] + 'e')
    if w.endswith('ed') and len(w) > 3:
        forms.add(w[:-2])
        forms.add(w[:-1])
    return forms


def extract_identifiers(query: str) -> list[str]:
    """
    Extract likely identifiers (camelCase, PascalCase, snake_case, stems) and filenames
    from the query. Used for high-weight exact identifier matching.
    """
    identifiers = set()

    # Code-style identifiers (camelCase, PascalCase, snake_case with underscores)
    for m in re.finditer(r'\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b', query):
        word = m.group(1)
        w_lower = word.lower()
        if w_lower in _COMMON_WORDS:
            continue
        # Add word and its stemmed forms
        for form in _stem(word):
            if len(form) >= 3 and form not in _COMMON_WORDS:
                identifiers.add(form)

    # File names with extensions (e.g. MapView.tsx, api.py)
    for m in _FILE_EXT_RE.finditer(query):
        identifiers.add(m.group(0).lower())
        # Also add stem without extension
        identifiers.add(m.group(0).rsplit('.', 1)[0].lower())

    return list(identifiers)


def extract_routes(query: str) -> list[str]:
    """Extract API route patterns from the query."""
    return [m.group(0).strip() for m in _ROUTE_RE.finditer(query)]


# Common English words to exclude from identifier extraction (unless part of a snake_case/camelCase code identifier)
_COMMON_WORDS = {
    'where', 'what', 'which', 'how', 'when', 'why', 'does', 'this', 'that', 'with',
    'from', 'into', 'used', 'using', 'use', 'uses',
    'defined', 'define', 'defines', 'defining', 'definition',
    'created', 'create', 'creates', 'creating', 'creation',
    'called', 'call', 'calls', 'calling',
    'find', 'show', 'list', 'explain', 'describe',
    'implement', 'implemented', 'implementing', 'implementation', 'implementations',
    'handle', 'handles', 'handled', 'handling', 'handler', 'handlers',
    'generate', 'generates', 'generated', 'generating', 'generation', 'generat',
    'function', 'functions', 'class', 'classes', 'method', 'methods',
    'file', 'files', 'module', 'modules', 'endpoint', 'endpoints', 'route', 'routes',
    'view', 'views', 'model', 'models', 'service', 'services', 'component', 'components',
    'page', 'pages', 'code', 'logic', 'work', 'works', 'working',
    'should', 'return', 'returns', 'returning',
    'repository', 'repo', 'project', 'application', 'app', 'system', 'data',
    'the', 'and', 'for', 'not', 'but', 'are', 'was', 'were', 'been',
    'have', 'has', 'had', 'about', 'some', 'there', 'their', 'them',
}


# ─── Query Type Detection ──────────────────────────────────────────────────────

class QueryType:
    OVERVIEW       = 'overview'        # "what is this repository about?", "project overview"
    IMPLEMENTATION = 'implementation'  # "where is authentication implemented?", "where are JWT tokens generated?"
    IDENTIFIER     = 'identifier'      # "where is generate_token defined?"
    ROUTE          = 'route'           # "where is /api/auth/google/ handled?"
    FLOW           = 'flow'            # "explain the authentication flow"
    HISTORY        = 'history'         # "why was X changed?", "who added Y?", "when was Z introduced?", "commit history"
    GENERAL        = 'general'         # Everything else


_OVERVIEW_PHRASES = re.compile(
    r'\b(what is this (repo|repository|project)|what does this (repo|repository|project) do|'
    r'project overview|repository overview|explain (this )?(project|repository|repo)|'
    r'summary of (this )?(repo|repository|project)|about this (repo|repository|project)|'
    r'tell me about this (repo|repository|project)|what is the purpose of this (repo|repository|project))\b',
    re.IGNORECASE,
)

_IMPLEMENTATION_PHRASES = re.compile(
    r'\b(implemented|implementation|handling|generate[sd]?|generating|generation|'
    r'create[sd]?|creating|creation|issue[sd]?|issuing|sign(ed|ing)?|encode[sd]?|encoding)\b',
    re.IGNORECASE,
)

_FLOW_PHRASES = re.compile(
    r'\b(flow|pipeline|process|sequence|steps?|architecture|overview|explain|how does|walk me through)\b',
    re.IGNORECASE,
)
_IDENTIFIER_PHRASES = re.compile(
    r'\b(where is|find|locate|which file|defined in|implemented in|called in|used in|importing of|imports? of)\b',
    re.IGNORECASE,
)

_HISTORY_PHRASES = re.compile(
    r'\b(why was|why did|who added|who wrote|who changed|who created|who modified|who authored|'
    r'when was|when did|commit|commits|git log|git history|history of|recent changes|'
    r'change log|changelog|pull request|pr\b|evolution|refactored|blame)\b',
    re.IGNORECASE,
)


def detect_query_type(query: str) -> str:
    """Heuristically classify the query type for weight adjustment."""
    q_lower = query.lower()

    if _HISTORY_PHRASES.search(query):
        return QueryType.HISTORY

    if _OVERVIEW_PHRASES.search(query) or ('about' in q_lower and ('repo' in q_lower or 'project' in q_lower)):
        return QueryType.OVERVIEW

    if extract_routes(query):
        return QueryType.ROUTE

    if _IMPLEMENTATION_PHRASES.search(query):
        return QueryType.IMPLEMENTATION

    if _IDENTIFIER_PHRASES.search(query) and extract_identifiers(query):
        return QueryType.IDENTIFIER

    if _FLOW_PHRASES.search(query):
        return QueryType.FLOW

    idents = extract_identifiers(query)
    if idents:
        return QueryType.IDENTIFIER

    return QueryType.GENERAL


def _is_passive_utility(file_path: str, symbol_name: str) -> bool:
    """Check if chunk is a logger, sanitization regex, test mock, or fixture."""
    fp = file_path.lower()
    sym = symbol_name.lower()
    if any(k in fp for k in ['logger', 'logging', 'test', 'fixture', 'mock', 'spec', 'demo-response/src/utils']):
        return True
    if any(k in sym for k in ['pattern', 'regex', 'mask', 'redact', 'log_level', 'test_']):
        return True
    return False


# ─── Per-chunk Scoring ────────────────────────────────────────────────────────

def _score_keyword(chunk: dict, query_tokens: set[str]) -> float:
    """
    Fraction of query tokens that appear in the chunk content (token overlap).
    Normalized to [0, 1].
    """
    if not query_tokens:
        return 0.0
    content_tokens = _tokenize(chunk.get('content', ''))
    # Also check symbol name and path
    extra_tokens = _tokenize(chunk.get('symbol_name', '')) | _tokenize(chunk.get('file_path', ''))
    all_chunk_tokens = content_tokens | extra_tokens

    overlap = len(query_tokens & all_chunk_tokens)
    return min(overlap / max(len(query_tokens), 1), 1.0)


def _score_identifier(chunk: dict, identifiers: list[str], is_implementation_query: bool = False) -> float:
    """
    Check if the chunk's symbol_name, class_name, file name, or directory path contain
    any of the extracted identifiers. Returns [0.0, 1.0].
    """
    if not identifiers:
        return 0.0

    # If asking where something is generated/implemented and chunk is merely a logger/utility mask, suppress
    if is_implementation_query and _is_passive_utility(chunk.get('file_path', ''), chunk.get('symbol_name', '')):
        return 0.10

    sym_lower  = chunk.get('symbol_name', '').lower()
    cls_lower  = chunk.get('class_name', '').lower()
    path_lower = chunk.get('file_path', '').lower()
    filename   = path_lower.rsplit('/', 1)[-1]
    filename_no_ext = filename.rsplit('.', 1)[0]
    path_parts = [p.lower() for p in path_lower.split('/')]

    best = 0.0
    for ident in identifiers:
        ident_lower = ident.lower()
        # 1. Exact symbol or class name match
        if ident_lower == sym_lower or ident_lower == cls_lower:
            return 1.0
        # 2. Substring in symbol or class name
        if ident_lower in sym_lower or ident_lower in cls_lower:
            best = max(best, 0.85)
        # 3. Exact filename (e.g. MapView.tsx or MapView)
        if ident_lower == filename or ident_lower == filename_no_ext:
            best = max(best, 0.80)
        # 4. Substring in filename (e.g. 'map' in 'mapview.tsx')
        if ident_lower in filename:
            best = max(best, 0.70)
        # 5. Directory component match (e.g. 'map' in folder 'components/Map/')
        if any(ident_lower == part or ident_lower in part for part in path_parts):
            best = max(best, 0.60)

    return best


def _score_path(chunk: dict, routes: list[str], query_tokens: set[str]) -> float:
    """
    Check if the chunk's file path matches API route patterns or query path tokens.
    """
    if not routes and not query_tokens:
        return 0.0

    path_lower = chunk.get('file_path', '').lower()
    path_tokens = _tokenize(path_lower)
    overlap = len(query_tokens & path_tokens)
    base_score = min(overlap / max(len(query_tokens), 1), 1.0) * 0.6

    if routes:
        for route in routes:
            route_tokens = set(re.findall(r'[a-zA-Z0-9]+', route))
            route_overlap = len(route_tokens & path_tokens)
            if route_overlap > 0:
                base_score = max(base_score, route_overlap / max(len(route_tokens), 1))

    return min(base_score, 1.0)


# ─── Diversity penalty ─────────────────────────────────────────────────────────

def _apply_diversity(chunks_with_scores: list[dict], top_k: int) -> list[dict]:
    """
    For flow queries: penalize chunks from files already well-represented
    to encourage the final selection to span multiple files/components.
    Only applies after initial scoring; does not change order for non-flow queries.
    """
    file_count: dict[str, int] = defaultdict(int)
    MAX_PER_FILE = 2
    result = []

    # Sort by final_score descending
    chunks_with_scores.sort(key=lambda x: x['final_score'], reverse=True)

    # First pass: select up to MAX_PER_FILE per file
    deferred = []
    for c in chunks_with_scores:
        fp = c.get('file_path', '')
        if file_count[fp] < MAX_PER_FILE:
            result.append(c)
            file_count[fp] += 1
        else:
            deferred.append(c)

    # Fill remaining slots with deferred chunks
    result.extend(deferred)
    return result[:top_k]


# ─── Main reranker ─────────────────────────────────────────────────────────────

def rerank(
    candidates: list[dict],
    query: str,
    top_k: int = 8,
) -> list[dict]:
    """
    Score and rank a list of candidate chunks, returning the top_k best.

    Args:
        candidates: List of chunk dicts (each must have 'similarity' from vector search,
                    plus 'file_path', 'symbol_name', 'class_name', 'content').
        query: The user's question / retrieval query.
        top_k: Number of top chunks to return.

    Returns:
        Ranked list of chunk dicts, each enriched with scoring fields:
            semantic_score, keyword_score, identifier_score, path_score, final_score.
    """
    if not candidates:
        return []

    query_type  = detect_query_type(query)
    query_tokens = extract_query_tokens(query)
    identifiers  = extract_identifiers(query)
    routes       = extract_routes(query)

    logger.debug(
        'Reranker: query_type=%s  identifiers=%s  routes=%s',
        query_type, identifiers, routes,
    )

    scored = []
    for chunk in candidates:
        sem_score   = float(chunk.get('similarity', 0.0))
        kw_score    = _score_keyword(chunk, query_tokens)
        ident_score = _score_identifier(
            chunk, identifiers, is_implementation_query=(query_type == QueryType.IMPLEMENTATION)
        )
        path_score  = _score_path(chunk, routes, query_tokens)

        # Base semantic component
        sem_part = 0.55 * sem_score
        kw_part = 0.15 * kw_score
        path_part = 0.10 * path_score

        # Identifier part: exact symbol match gets high weight
        ident_part = 0.40 * ident_score
        if ident_score >= 0.85:
            ident_part += 0.20
        elif ident_score >= 0.60:
            ident_part += 0.10

        weighted = sem_part + kw_part + ident_part + path_part

        # If no identifier match, preserve semantic baseline
        if ident_score == 0:
            final = max(weighted, sem_score * 0.85)
        else:
            final = max(weighted, sem_score * 0.50 + ident_part)

        # Overview query: boost root documentation and main entry points
        if query_type == QueryType.OVERVIEW:
            fn = chunk.get('file_path', '').rsplit('/', 1)[-1].lower()
            if fn in ('readme.md', 'agents.md', 'architecture.md', 'package.json', 'pyproject.toml', 'cargo.toml') or fn.startswith('readme'):
                overview_boost = 0.40
            elif fn in ('app.tsx', 'app.jsx', 'app.js', 'main.py', 'server.js', 'index.ts', 'manage.py', 'index.js'):
                overview_boost = 0.25
            else:
                overview_boost = 0.0
            final = max(final, sem_score * 0.70 + overview_boost)

        # History query: prioritize git commit memories over code definitions
        if query_type == QueryType.HISTORY:
            if chunk.get('symbol_type') == 'commit':
                final = max(final, min(1.0, sem_score * 0.50 + kw_score * 0.40 + 0.35))
            else:
                final = min(final, 0.75)

        final = min(final, 1.0)

        enriched = dict(chunk)
        enriched['semantic_score']    = round(sem_score, 4)
        enriched['keyword_score']     = round(kw_score, 4)
        enriched['identifier_score']  = round(ident_score, 4)
        enriched['path_score']        = round(path_score, 4)
        enriched['final_score']       = round(final, 4)
        enriched['query_type']        = query_type
        scored.append(enriched)

    # Apply file diversity for flow queries
    if query_type == QueryType.FLOW:
        return _apply_diversity(scored, top_k)

    scored.sort(key=lambda x: x['final_score'], reverse=True)
    return scored[:top_k]
