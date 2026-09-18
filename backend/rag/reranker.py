"""
Deterministic Reranker (Phase 3.5 — Strict Grounding & Hallucination Fix).

Combines semantic similarity with exact identifier matching, file path signals,
intent classification, passive utility penalties, and absolute relevance gating.

Phase 3.5 Improvements:
1. Expanded QueryType taxonomy:
   OVERVIEW, IMPLEMENTATION, IDENTIFIER, HISTORY, ARCHITECTURE,
   DEPENDENCY, CONFIGURATION, API, GENERAL.
2. Core Entity / Subject Extraction:
   Separates intent frame words ("who", "when", "in which commit", "where is", "explain")
   from target entity keywords ("authentication", "Redis", "MapView").
3. Absolute Relevance Gating:
   Rejects candidates that fail absolute criteria (weak semantic similarity without entity
   overlap, passive utilities, data lookups). Top-K relative ranking does NOT mean relevant.
4. History Evidence Enforcement:
   For historical queries, prioritizes CommitMemory matching target entities.
5. Diversity & Duplicate Control:
   Enforces maximum chunks per file (2) and maximum chunks per directory (3).
6. Comprehensive Evaluation & Rejection Logging:
   Tracks selected flag and explicit rejection reasons for every candidate, powering
   the enhanced debug mode.
"""

import os
import re
import logging
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Configurable weights & thresholds ─────────────────────────────────────────

_W_SEM   = float(os.getenv('RAG_WEIGHT_SEMANTIC',    '0.45'))
_W_KW    = float(os.getenv('RAG_WEIGHT_KEYWORD',     '0.25'))
_W_IDENT = float(os.getenv('RAG_WEIGHT_IDENTIFIER',  '0.20'))
_W_PATH  = float(os.getenv('RAG_WEIGHT_PATH',        '0.10'))

# Absolute relevance gate: minimum score required to be eligible for context
RELEVANCE_GATE_THRESHOLD = float(os.getenv('RAG_RELEVANCE_GATE_THRESHOLD', '0.28'))

# Maximum chunks allowed per file and per directory
MAX_CHUNKS_PER_FILE = int(os.getenv('RAG_MAX_CHUNKS_PER_FILE', '2'))
MAX_CHUNKS_PER_DIR  = int(os.getenv('RAG_MAX_CHUNKS_PER_DIR', '3'))


# ─── Token extraction ──────────────────────────────────────────────────────────

_SPLIT_RE = re.compile(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[_\-\s./]+')
_ROUTE_RE = re.compile(r'(?:^|[\s"\'`])/[a-zA-Z0-9_/\-:]+/')
_FILE_EXT_RE = re.compile(r'\b\w+\.(py|ts|tsx|js|jsx|java|go|rb|rs|cpp|cs|json|ya?ml|toml|env)\b')


def _tokenize(text: str) -> set[str]:
    """Split text into lowercase alphanumeric and sub-word tokens."""
    tokens = set()
    words = re.findall(r'[a-zA-Z0-9_]+', text)
    for word in words:
        subparts = re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)', word)
        for part in subparts or [word]:
            part = part.strip().lower()
            if len(part) >= 2:
                tokens.add(part)
        for part in word.split('_'):
            part = part.strip().lower()
            if len(part) >= 2:
                tokens.add(part)
        if len(word) >= 2:
            tokens.add(word.lower())
    return tokens


def extract_query_tokens(query: str) -> set[str]:
    """Extract meaningful tokens from a user query."""
    return _tokenize(query)


def _stem(word: str) -> set[str]:
    """Return set of normalized base forms for a word."""
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
    'who', 'did', 'all', 'in', 'commit', 'commits', 'pr', 'pull', 'request',
    'main', 'core', 'present', 'business', 'codebase', 'primary', 'general',
    'thid', 'teh', 'tell', 'can', 'you',
}

# Conversational frame words to strip when identifying the core subject/entity
_FRAME_WORDS = {
    'where', 'is', 'the', 'what', 'does', 'how', 'when', 'who', 'why', 'did',
    'it', 'and', 'in', 'which', 'commit', 'commits', 'explain', 'all', 'of',
    'this', 'project', 'repo', 'repository', 'code', 'file', 'files', 'for',
    'are', 'can', 'you', 'tell', 'me', 'about', 'used', 'uses', 'using',
    'implementation', 'implemented', 'handled', 'handling', 'defined',
    'main', 'core', 'present', 'logic', 'business', 'codebase', 'primary',
    'thid', 'teh',
    # Temporal & grammatical framing words
    'was', 'were', 'been', 'had', 'has', 'have', 'last', 'latest', 'recent',
    'first', 'initial', 'newest', 'oldest', 'make', 'made', 'show', 'give',
    'find', 'list', 'describe',
}

# ─── Domain Concept Synonyms ──────────────────────────────────────────────────

CONCEPT_SYNONYMS: dict[str, set[str]] = {
    'authentication': {'auth', 'authenticate', 'login', 'logout', 'signin', 'signup', 'session', 'password', 'credential', 'token', 'jwt', 'oauth', 'checklogin'},
    'auth': {'authentication', 'login', 'logout', 'signin', 'signup', 'session', 'password', 'credential', 'token', 'jwt', 'oauth', 'checklogin'},
    'login': {'auth', 'authentication', 'signin', 'session', 'password', 'credential', 'checklogin'},
    'database': {'db', 'sql', 'model', 'models', 'schema', 'migration', 'query', 'table', 'mysql', 'postgres', 'sqlite'},
    'api': {'endpoint', 'endpoints', 'route', 'routes', 'controller', 'controllers', 'view', 'views', 'rest', 'handler'},
}


def expand_concept_synonyms(tokens: set[str]) -> set[str]:
    """Expand token set with synonyms for universal software concepts."""
    expanded = set(tokens)
    for t in tokens:
        t_low = t.lower()
        if t_low in CONCEPT_SYNONYMS:
            expanded.update(CONCEPT_SYNONYMS[t_low])
        for concept, syns in CONCEPT_SYNONYMS.items():
            if t_low in syns:
                expanded.add(concept)
                expanded.update(syns)
    return expanded


def extract_identifiers(query: str) -> list[str]:
    """Extract likely identifiers (camelCase, snake_case) and filenames."""
    identifiers = set()

    for m in re.finditer(r'\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b', query):
        word = m.group(1)
        w_lower = word.lower()
        if w_lower in _COMMON_WORDS:
            continue
        for form in _stem(word):
            if len(form) >= 3 and form not in _COMMON_WORDS:
                identifiers.add(form)

    for m in _FILE_EXT_RE.finditer(query):
        identifiers.add(m.group(0).lower())
        identifiers.add(m.group(0).rsplit('.', 1)[0].lower())

    return list(identifiers)


def extract_routes(query: str) -> list[str]:
    """Extract API route patterns from the query."""
    return [m.group(0).strip() for m in _ROUTE_RE.finditer(query)]


def extract_core_entities(query: str) -> set[str]:
    """
    Extract the core subject entities from the query, stripping conversational frame words.
    E.g. "explain all the authentication of this project, when and who did it and in which commit"
    -> {"authentication"}
    """
    tokens = _tokenize(query)
    core = {t for t in tokens if t not in _FRAME_WORDS and len(t) >= 3}
    return core


# ─── Query Type Taxonomy ──────────────────────────────────────────────────────

class QueryType:
    OVERVIEW       = 'overview'        # "what is this repository about?", "project overview"
    IMPLEMENTATION = 'implementation'  # "where is authentication implemented?", "where are JWT tokens generated?"
    IDENTIFIER     = 'identifier'      # "where is MapView?", "where is generate_token defined?"
    HISTORY        = 'history'         # "why was Redis introduced?", "who implemented auth?", "in which commit?"
    ARCHITECTURE   = 'architecture'    # "how does frontend communicate with backend?", "system architecture"
    DEPENDENCY     = 'dependency'      # "what external packages are used?", "what does this project use Gemini for?"
    CONFIGURATION  = 'configuration'   # "how is database configured?", "environment variables"
    API            = 'api'             # "which API is used for maps?", "what endpoints exist?"
    FLOW           = 'flow'            # "explain the authentication flow"
    ROUTE          = 'route'           # "where is /api/auth/google/ handled?"
    GENERAL        = 'general'         # Everything else


_OVERVIEW_PHRASES = re.compile(
    r'\b(what is this about|what is this (repo|repository|project|codebase|app|application)|'
    r'what does this (repo|repository|project|codebase|app|application) do|'
    r'what does it do|project overview|repository overview|codebase overview|'
    r'explain (this|the) (project|repository|repo|codebase|app)|'
    r'summary of (this|the) (repo|repository|project|codebase)|'
    r'about this (repo|repository|project|codebase)|'
    r'tell me about this|tell me about the (project|repo|codebase)|'
    r'what is the purpose of this (repo|repository|project|codebase)|give me an overview)\b',
    re.IGNORECASE,
)

_CORE_LOGIC_PHRASES = re.compile(
    r'\b(main logic|core logic|business logic|application logic|main code|backend logic|core code)\b',
    re.IGNORECASE,
)

_FEATURE_USAGE_PHRASES = re.compile(
    r'\b(is \w+ used|does this (repo|project|codebase|app) use|is there any \w+|does it support|is \w+ supported|how is \w+ used)\b',
    re.IGNORECASE,
)

_HISTORY_PHRASES = re.compile(
    r'\b(why was|why did|who added|who wrote|who changed|who created|who modified|who authored|'
    r'who implemented|when was|when did|in which commit|which commit|commit\b|commits\b|'
    r'latest commit|last commit|recent commit|recent commits|most recent commit|newest commit|'
    r'first commit|initial commit|who made the last commit|when was the last commit|'
    r'git log|git history|history of|recent changes|change log|changelog|pull request|'
    r'pr\b|evolution|refactored|blame)\b',
    re.IGNORECASE,
)

_RECENCY_RE = re.compile(
    r'\b(last|latest|most recent|newest|recent)\s+(commit|commits|change|changes|update|updates|work|push)\b|'
    r'\b(when|who|what)\s+(was|is|made|authored)\s+the\s+(last|latest|most recent|newest)\b|'
    r'\b(when|who|what)\s+(was|is|made|authored).*?(last|latest|most recent|newest)\s+(commit|commits|change|changes)\b|'
    r'\bwhen was the (last|latest|most recent|newest)\b|'
    r'\b(last|latest|most recent|newest)\s+commits?\b',
    re.IGNORECASE,
)

_INITIAL_COMMIT_RE = re.compile(
    r'\b(first|initial)\s+(commit|commits|change|changes)\b|'
    r'\b(when|who|what)\s+(was|is|made|authored)\s+the\s+(first|initial)\s+(commit|change)\b',
    re.IGNORECASE,
)

_EXPLICIT_COMMIT_SHA_RE = re.compile(
    r'\bcommit\s+([0-9a-f]{7,40})\b',
    re.IGNORECASE,
)


def is_recency_query(query: str) -> bool:
    """Return True if query is asking for latest/last/recent commits."""
    return bool(_RECENCY_RE.search(query))


def is_initial_commit_query(query: str) -> bool:
    """Return True if query is asking for the initial/first commit."""
    return bool(_INITIAL_COMMIT_RE.search(query))


def extract_commit_sha(query: str) -> Optional[str]:
    """Extract an explicit commit SHA from a query (e.g. 'commit d6dabaab' or 'when was commit X?')."""
    m = _EXPLICIT_COMMIT_SHA_RE.search(query)
    if m:
        return m.group(1).lower()
    for token in query.split():
        clean_token = token.strip('?,.!`\'"()')
        if len(clean_token) in range(7, 41) and re.fullmatch(r'[0-9a-f]{7,40}', clean_token, re.IGNORECASE):
            if not clean_token.isdigit():
                return clean_token.lower()
    return None

_ARCHITECTURE_PHRASES = re.compile(
    r'\b(architecture|architectural|how does (frontend|backend|client|server) communicate|'
    r'communication between|data flow|system design|high level design|structure of the project|'
    r'frontend architecture|backend architecture)\b',
    re.IGNORECASE,
)

_DEPENDENCY_PHRASES = re.compile(
    r'\b(dependenc(y|ies)|packages?|libraries|external packages?|third-?party|requirements|'
    r'what does this project use .* for|what is .* used for|npm packages?|gemini sdk)\b',
    re.IGNORECASE,
)

_CONFIGURATION_PHRASES = re.compile(
    r'\b(config|configuration|settings|environment variables?|\.env|database configuration|setup|docker-compose|dockerfile)\b',
    re.IGNORECASE,
)

_API_PHRASES = re.compile(
    r'\b(which api|what api|api endpoint|endpoints?|rest api|api for|route|routes|http (methods?|requests?))\b',
    re.IGNORECASE,
)

_IMPLEMENTATION_PHRASES = re.compile(
    r'\b(implemented|implementation|handling|generate[sd]?|generating|generation|'
    r'create[sd]?|creating|creation|issue[sd]?|issuing|sign(ed|ing)?|encode[sd]?|encoding)\b',
    re.IGNORECASE,
)

_FLOW_PHRASES = re.compile(
    r'\b(flow|pipeline|sequence|steps?|walk me through)\b',
    re.IGNORECASE,
)

_IDENTIFIER_PHRASES = re.compile(
    r'\b(where is|find|locate|which file|defined in|called in|used in|importing of|imports? of)\b',
    re.IGNORECASE,
)


def detect_query_type(query: str) -> str:
    """Classify the primary query intent."""
    q_lower = query.lower().strip()
    q_norm = q_lower.rstrip('?.! ')

    # 1. History intent has highest precedence for historical queries
    if _HISTORY_PHRASES.search(query):
        return QueryType.HISTORY

    # 2. Multi-step flow queries (e.g. "explain the authentication flow")
    if _FLOW_PHRASES.search(query):
        return QueryType.FLOW

    # 3. Dependencies and external libraries (e.g. "what does this project use Gemini for?")
    if _DEPENDENCY_PHRASES.search(query):
        return QueryType.DEPENDENCY

    # 4. Direct/concise overview queries (e.g. "what is this about", "what is this", "explain this")
    if q_norm in {'what is this about', 'what is this', 'what does this do', 'what does it do', 'explain this', 'tell me about this', 'overview', 'summary', 'about', 'about this'}:
        return QueryType.OVERVIEW
    if _OVERVIEW_PHRASES.search(query) or ('about' in q_lower and any(w in q_lower for w in ('repo', 'project', 'codebase', 'system', 'app'))):
        return QueryType.OVERVIEW

    # 5. Core application logic / architecture questions (e.g. "where is the main logic code present?")
    if _CORE_LOGIC_PHRASES.search(query):
        return QueryType.ARCHITECTURE

    # 6. Feature presence / usage queries (e.g. "is authentication used in this repo?")
    if _FEATURE_USAGE_PHRASES.search(query):
        return QueryType.IMPLEMENTATION

    # 7. High-level architecture / system design
    if _ARCHITECTURE_PHRASES.search(query):
        return QueryType.ARCHITECTURE

    # 8. Configuration and environment
    if _CONFIGURATION_PHRASES.search(query):
        return QueryType.CONFIGURATION

    # 9. APIs and endpoints
    if _API_PHRASES.search(query):
        return QueryType.API

    # 10. Exact API routes
    if extract_routes(query):
        return QueryType.ROUTE

    # 11. Implementation
    if _IMPLEMENTATION_PHRASES.search(query):
        return QueryType.IMPLEMENTATION

    # 12. Identifier lookup (only when specifically asking to find an identifier or symbol)
    if _IDENTIFIER_PHRASES.search(query) and extract_identifiers(query):
        return QueryType.IDENTIFIER

    return QueryType.GENERAL


# ─── Passive Utility & Boilerplate Detection ──────────────────────────────────

def _is_passive_utility(file_path: str, symbol_name: str) -> bool:
    """
    Check if chunk is a logger, sanitization regex, test mock, fixture,
    lookup dictionary, spatial enricher, vendor library, font/asset, or data mapper.
    """
    fp = file_path.lower()
    sym = symbol_name.lower()

    # Vendor, third-party libraries, fonts, compressed assets
    if any(k in fp for k in [
        'tcpdf', 'font-awesome', 'fonts/', '/fonts', 'vendor/', 'node_modules/',
        'bower_components/', 'assets/fonts', 'third_party/', 'third-party/',
    ]):
        return True
    if fp.endswith(('.ctg.z', '.z', '.otf', '.ttf', '.woff', '.woff2', '.eot', '.icc', '.ai', '.fdf')):
        return True

    # Logging, tests, mocks, fixtures
    if any(k in fp for k in ['logger', 'logging', 'test', 'fixture', 'mock', 'spec', 'demo-response/src/utils', 'tests/']):
        return True
    if any(k in sym for k in ['pattern', 'regex', 'mask', 'redact', 'log_level', 'test_']):
        return True

    # Data lookups, spatial enrichments, classification tables, seeds
    if any(k in fp for k in ['_lookup', '_enrich', 'classify', 'lookup.', 'lookups/', 'seed', 'dataset', 'fixtures']):
        return True

    return False


# ─── Scoring Functions ────────────────────────────────────────────────────────

def _score_keyword(chunk: dict, query_tokens: set[str]) -> float:
    """Token overlap fraction between query tokens (and concept synonyms) and chunk content + metadata."""
    if not query_tokens:
        return 0.0
    content_tokens = _tokenize(chunk.get('content', ''))
    extra_tokens = (
        _tokenize(chunk.get('symbol_name', '')) |
        _tokenize(chunk.get('file_path', '')) |
        _tokenize(chunk.get('class_name', ''))
    )
    all_chunk_tokens = content_tokens | extra_tokens

    matches = 0.0
    for q_tok in query_tokens:
        q_syns = expand_concept_synonyms({q_tok})
        if q_tok in all_chunk_tokens or (q_syns & all_chunk_tokens):
            matches += 1.0
        elif any(
            (len(q_tok) >= 4 and len(c_tok) >= 4 and (q_tok.startswith(c_tok) or c_tok.startswith(q_tok)))
            or (len(c_tok) >= 3 and c_tok in q_tok)
            or any((len(s) >= 4 and len(c_tok) >= 4 and (s.startswith(c_tok) or c_tok.startswith(s))) for s in q_syns)
            for c_tok in all_chunk_tokens
        ):
            matches += 0.8

    return min(matches / max(len(query_tokens), 1), 1.0)


def _score_identifier(chunk: dict, identifiers: list[str], is_implementation_query: bool = False) -> float:
    """Score match of chunk symbol, class, and file against extracted identifiers and concept synonyms."""
    if not identifiers:
        return 0.0

    if is_implementation_query and _is_passive_utility(chunk.get('file_path', ''), chunk.get('symbol_name', '')):
        return 0.05

    sym_lower  = chunk.get('symbol_name', '').lower()
    cls_lower  = chunk.get('class_name', '').lower()
    path_lower = chunk.get('file_path', '').lower()
    filename   = path_lower.rsplit('/', 1)[-1]
    filename_no_ext = filename.rsplit('.', 1)[0]
    path_parts = [p.lower() for p in path_lower.split('/')]

    # Expand identifiers with concept synonyms (e.g. authentication -> auth, login, checklogin)
    expanded_idents = expand_concept_synonyms(set(identifiers))

    best = 0.0
    for ident in expanded_idents:
        ident_lower = ident.lower()
        if ident_lower == sym_lower or ident_lower == cls_lower:
            return 1.0
        # Substring in symbol or class (either direction)
        if (ident_lower in sym_lower or (len(sym_lower) >= 3 and sym_lower in ident_lower)):
            best = max(best, 0.85)
        elif (ident_lower in cls_lower or (len(cls_lower) >= 3 and cls_lower in ident_lower)):
            best = max(best, 0.80)
        elif ident_lower == filename or ident_lower == filename_no_ext:
            best = max(best, 0.80)
        elif (ident_lower in filename or (len(filename_no_ext) >= 3 and filename_no_ext in ident_lower)):
            best = max(best, 0.70)
        elif any((ident_lower in part or (len(part) >= 3 and part in ident_lower)) for part in path_parts):
            best = max(best, 0.65)

    return best


def _score_path(chunk: dict, routes: list[str], query_tokens: set[str]) -> float:
    """Score match of file path against API routes and path tokens with concept expansion."""
    if not routes and not query_tokens:
        return 0.0

    path_lower = chunk.get('file_path', '').lower()
    path_tokens = _tokenize(path_lower)
    expanded_tokens = expand_concept_synonyms(query_tokens)
    overlap = len(expanded_tokens & path_tokens)
    base_score = min(overlap / max(len(query_tokens), 1), 1.0) * 0.7

    if routes:
        for route in routes:
            route_tokens = set(re.findall(r'[a-zA-Z0-9]+', route))
            route_overlap = len(route_tokens & path_tokens)
            if route_overlap > 0:
                base_score = max(base_score, route_overlap / max(len(route_tokens), 1))

    return min(base_score, 1.0)


def _score_intent(chunk: dict, query_type: str, core_entities: set[str]) -> float:
    """
    Score compatibility between chunk type/path and query intent.
    Returns value in [-0.5, 0.5] to adjust final score.
    """
    fp = chunk.get('file_path', '').lower()
    sym_type = chunk.get('symbol_type', '')

    if query_type == QueryType.HISTORY:
        if sym_type == 'commit':
            # Deterministic recency commit, initial commit, or exact SHA
            if chunk.get('is_recency') or chunk.get('is_exact_sha') or chunk.get('is_initial'):
                return 0.50
            # Check if commit message / files touch any core entity
            chunk_tokens = _tokenize(chunk.get('content', '')) | _tokenize(fp)
            if core_entities and (core_entities & chunk_tokens):
                return 0.45
            elif not core_entities:
                return 0.40
            return -0.10  # Commit unrelated to target entity
        else:
            # Code chunk in a history question: supporting role only
            if not core_entities:
                return -0.25
            return -0.15

    if query_type == QueryType.OVERVIEW:
        fn = fp.rsplit('/', 1)[-1]
        if fn in ('readme.md', 'agents.md', 'architecture.md', 'package.json', 'pyproject.toml') or fn.startswith('readme'):
            return 0.50
        if fn in ('app.tsx', 'app.jsx', 'app.js', 'main.py', 'server.js', 'index.ts', 'manage.py', 'index.js', 'index.php', 'admin-panel.php', 'admin-panel1.php'):
            return 0.35
        return -0.10

    if query_type == QueryType.ARCHITECTURE:
        fn = fp.rsplit('/', 1)[-1]
        if fn.startswith(('index.', 'func', 'admin', 'doctor', 'patient', 'server.', 'app.', 'main.')) or any(k in fp for k in ['api', 'client', 'service', 'urls', 'routes', 'controllers', 'views']):
            return 0.35
        return 0.0

    if query_type == QueryType.DEPENDENCY:
        if any(k in fp for k in ['package.json', 'pyproject.toml', 'requirements', 'cargo.toml', 'pom.xml']):
            return 0.40
        return 0.0

    if query_type == QueryType.CONFIGURATION:
        if any(k in fp for k in ['settings', 'config', '.env', 'docker', 'application.yml', 'constants']):
            return 0.40
        return 0.0

    if query_type == QueryType.API:
        if any(k in fp for k in ['views', 'routes', 'controllers', 'endpoints', 'api', 'urls']):
            return 0.35
        return 0.0

    return 0.0


# ─── Absolute Relevance Gate ──────────────────────────────────────────────────

def evaluate_relevance(
    chunk: dict,
    query_type: str,
    core_entities: set[str],
    sem_score: float,
    ident_score: float,
    kw_score: float,
    path_score: float,
    intent_score: float,
    final_score: float,
) -> tuple[bool, Optional[str]]:
    """
    Perform an absolute relevance evaluation on a candidate chunk.
    Top-K relative selection is NOT enough — a chunk must meet minimum
    absolute evidence criteria to be sent to Gemini.
    """
    fp = chunk.get('file_path', '').lower()
    sym_type = chunk.get('symbol_type', '')
    is_passive = _is_passive_utility(fp, chunk.get('symbol_name', ''))

    # 1. Passive utility / vendor filter: when searching for implementations/features,
    # penalize passive lookup / logger / vendor files unless there is an exact identifier match
    if is_passive:
        if not any(k in fp for k in ['readme']):
            if ident_score < 0.85 and kw_score < 0.40:
                return False, 'passive utility, vendor library, or data lookup'

    # 2. History queries: commit evidence rules
    if query_type == QueryType.HISTORY:
        if sym_type == 'commit':
            # Recency, initial, or exact SHA commits ALWAYS pass the relevance gate
            if chunk.get('is_recency') or chunk.get('is_exact_sha') or chunk.get('is_initial') or sem_score >= 0.80:
                return True, None
            # If no specific core entity is named (e.g. "when was the last commit", "recent commits"),
            # all retrieved commit candidates pass as valid history evidence
            if not core_entities:
                if sem_score >= 0.15 or kw_score >= 0.10:
                    return True, None
                return False, 'commit below baseline relevance threshold'
            # Commit must relate to core entity if core entity exists
            chunk_tokens = _tokenize(chunk.get('content', '')) | _tokenize(fp)
            expanded_entities = expand_concept_synonyms(core_entities)
            if not (expanded_entities & chunk_tokens) and sem_score < 0.40:
                return False, 'commit does not match core target entity'
            if sem_score < 0.25 and kw_score < 0.15:
                return False, 'weak commit match below history relevance threshold'
            return True, None
        else:
            # Code chunk in history query: must have substantial overlap with target entity
            if not core_entities:
                return False, 'code chunk in general history query without target entity'
            chunk_tokens = _tokenize(chunk.get('content', '')) | _tokenize(chunk.get('symbol_name', '')) | _tokenize(fp)
            expanded_entities = expand_concept_synonyms(core_entities)
            if not (expanded_entities & chunk_tokens) and sem_score < 0.42:
                return False, 'code chunk in history query without target entity overlap'

    # 3. Overview queries: README and root manifests ALWAYS pass
    if query_type == QueryType.OVERVIEW:
        fn = fp.rsplit('/', 1)[-1]
        if fn in ('readme.md', 'agents.md', 'architecture.md', 'package.json', 'pyproject.toml') or fn.startswith('readme'):
            return True, None
        if fn.startswith('index.') or fn in ('main.py', 'app.tsx', 'app.js', 'server.js', 'admin-panel.php', 'admin-panel1.php'):
            return True, None
        if sem_score >= 0.30:
            return True, None
        return False, 'non-overview file with low semantic similarity'

    # 4. Identifier queries: require identifier match or path match or strong keyword overlap
    if query_type == QueryType.IDENTIFIER:
        if ident_score >= 0.60 or path_score >= 0.50:
            return True, None
        if sem_score >= 0.45 and kw_score >= 0.20:
            return True, None
        return False, 'identifier query with weak identifier and path signals'

    # 5. Entity overlap check for implementation / API / general queries
    if core_entities:
        expanded_entities = expand_concept_synonyms(core_entities)
        chunk_tokens = _tokenize(chunk.get('content', '')) | _tokenize(chunk.get('symbol_name', '')) | _tokenize(fp)
        has_entity_overlap = bool(expanded_entities & chunk_tokens)
        if not has_entity_overlap:
            # If no core entity overlap at all, require very high semantic confidence (>= 0.50)
            if sem_score < 0.50 and ident_score < 0.60 and path_score < 0.60:
                return False, 'no core entity overlap and semantic score below threshold'

    # 6. Overall absolute score threshold check
    if final_score < RELEVANCE_GATE_THRESHOLD:
        return False, f'final score {final_score:.4f} below absolute threshold {RELEVANCE_GATE_THRESHOLD:.2f}'

    return True, None


# ─── Main Reranker ────────────────────────────────────────────────────────────

def rerank(
    candidates: list[dict],
    query: str,
    top_k: int = 8,
    return_all_evaluated: bool = False,
):
    """
    Score, evaluate, and rank candidate chunks.

    Applies absolute relevance gating, intent awareness, passive utility penalties,
    and diversity control.

    Args:
        candidates: List of candidate chunk dicts.
        query: The user's query text.
        top_k: Maximum number of accepted chunks to return.
        return_all_evaluated: If True, returns tuple (accepted_top_k, all_evaluated).
                              Default False for backward compatibility.

    Returns:
        If return_all_evaluated is False: list of accepted, ranked chunk dicts.
        If return_all_evaluated is True: (accepted_top_k, all_evaluated).
    """
    if not candidates:
        return ([], []) if return_all_evaluated else []

    query_type    = detect_query_type(query)
    query_tokens  = extract_query_tokens(query)
    identifiers   = extract_identifiers(query)
    routes        = extract_routes(query)
    core_entities = extract_core_entities(query)

    logger.debug(
        'Reranker: query_type=%s  core_entities=%s  identifiers=%s',
        query_type, core_entities, identifiers,
    )

    evaluated = []

    for chunk in candidates:
        sem_score   = float(chunk.get('similarity', 0.0))
        kw_score    = _score_keyword(chunk, query_tokens)
        ident_score = _score_identifier(
            chunk, identifiers, is_implementation_query=(query_type == QueryType.IMPLEMENTATION)
        )
        path_score  = _score_path(chunk, routes, query_tokens)
        intent_sc   = _score_intent(chunk, query_type, core_entities)

        # Weighted composition
        weighted = (
            _W_SEM * sem_score +
            _W_KW * kw_score +
            _W_IDENT * ident_score +
            _W_PATH * path_score
        )

        # Baseline logic
        if ident_score >= 0.80:
            final = max(weighted, 0.40 + ident_score * 0.45)
        elif ident_score >= 0.60:
            final = max(weighted, 0.35 + ident_score * 0.40)
        else:
            final = weighted

        # Add intent score adjustment
        final += intent_sc

        # Passive utility penalty when searching for features
        if _is_passive_utility(chunk.get('file_path', ''), chunk.get('symbol_name', '')):
            if query_type in (QueryType.IMPLEMENTATION, QueryType.IDENTIFIER, QueryType.API):
                final = max(0.0, final - 0.25)

        # Overview query boost
        if query_type == QueryType.OVERVIEW:
            fn = chunk.get('file_path', '').rsplit('/', 1)[-1].lower()
            if fn in ('readme.md', 'agents.md', 'architecture.md', 'package.json', 'pyproject.toml') or fn.startswith('readme'):
                final = max(final, 0.65 + sem_score * 0.30)
            elif fn.startswith('index.') or fn in ('main.py', 'app.tsx', 'app.js', 'server.js', 'admin-panel.php', 'admin-panel1.php'):
                final = max(final, 0.50 + sem_score * 0.30)

        # Core logic / architecture boost
        if query_type == QueryType.ARCHITECTURE:
            fn = chunk.get('file_path', '').rsplit('/', 1)[-1].lower()
            if fn.startswith(('index.', 'func', 'admin', 'doctor', 'patient', 'server.', 'app.', 'main.')) or any(k in chunk.get('file_path', '').lower() for k in ['service', 'controller', 'views']):
                final = max(final, 0.45 + sem_score * 0.35)

        # History query prioritization
        if query_type == QueryType.HISTORY:
            if chunk.get('symbol_type') == 'commit':
                chunk_tokens = _tokenize(chunk.get('content', '')) | _tokenize(chunk.get('file_path', ''))
                entity_match = bool(core_entities & chunk_tokens) if core_entities else True
                if entity_match:
                    final = max(final, 0.40 + sem_score * 0.40 + kw_score * 0.20)
            else:
                final = min(final, 0.70)

        final = max(0.0, min(1.0, final))

        # Absolute relevance gate
        is_relevant, rejection_reason = evaluate_relevance(
            chunk=chunk,
            query_type=query_type,
            core_entities=core_entities,
            sem_score=sem_score,
            ident_score=ident_score,
            kw_score=kw_score,
            path_score=path_score,
            intent_score=intent_sc,
            final_score=final,
        )

        enriched = dict(chunk)
        enriched['semantic_score']    = round(sem_score, 4)
        enriched['keyword_score']     = round(kw_score, 4)
        enriched['identifier_score']  = round(ident_score, 4)
        enriched['path_score']        = round(path_score, 4)
        enriched['intent_score']      = round(intent_sc, 4)
        enriched['final_score']       = round(final, 4)
        enriched['query_type']        = query_type
        enriched['selected']          = is_relevant
        enriched['rejection_reason']  = rejection_reason
        evaluated.append(enriched)

    # Filter into accepted vs rejected
    accepted = [c for c in evaluated if c['selected']]
    accepted.sort(key=lambda x: x['final_score'], reverse=True)

    # Apply diversity control (max chunks per file and max chunks per directory)
    file_counts: dict[str, int] = defaultdict(int)
    dir_counts: dict[str, int] = defaultdict(int)
    diverse_accepted = []

    for c in accepted:
        fp = c.get('file_path', '')
        dir_name = fp.rsplit('/', 1)[0] if '/' in fp else '.'

        if file_counts[fp] >= MAX_CHUNKS_PER_FILE:
            c['selected'] = False
            c['rejection_reason'] = f'diversity limit: maximum {MAX_CHUNKS_PER_FILE} chunks per file reached'
            continue

        if dir_counts[dir_name] >= MAX_CHUNKS_PER_DIR and len(accepted) > top_k:
            c['selected'] = False
            c['rejection_reason'] = f'diversity limit: maximum {MAX_CHUNKS_PER_DIR} chunks per directory reached'
            continue

        file_counts[fp] += 1
        dir_counts[dir_name] += 1
        diverse_accepted.append(c)

        if len(diverse_accepted) >= top_k:
            break

    if return_all_evaluated:
        return diverse_accepted, evaluated

    return diverse_accepted
