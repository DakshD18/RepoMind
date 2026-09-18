"""
Context Builder (Phase 2.1 — RAG Accuracy Upgrade).

Changes over Phase 2:
- Structured SOURCE N / FILE / Symbol / Type / Lines / CODE format.
- Groups chunks from the same file together (consistent file context).
- Deduplicates overlapping line ranges within the same file.
- Removes duplicate or near-identical content chunks before sending to Gemini.
- Larger context cap (14_000 chars) with per-source hard cap (2_000 chars).
- Does NOT include repository info in every chunk header (stated once at top).
"""

from collections import defaultdict

MAX_CONTEXT_CHARS   = 14_000    # Total context cap
MAX_SOURCE_CHARS    = 2_000     # Max code per single source block
MAX_SOURCES         = 12        # Hard upper limit on sources in context


def _strip_overlapping(chunks: list[dict]) -> list[dict]:
    """
    Within each file, remove chunks whose line range is fully contained within
    a larger chunk from the same file.
    """
    by_file: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        by_file[c['file_path']].append(c)

    result = []
    for fp, file_chunks in by_file.items():
        # Sort by start line
        sorted_chunks = sorted(
            file_chunks,
            key=lambda x: (x.get('start_line', 0), -(x.get('end_line', 0)))
        )
        kept = []
        for c in sorted_chunks:
            c_start = c.get('start_line', 0)
            c_end = c.get('end_line', 0)
            dominated = False
            for k in kept:
                k_start = k.get('start_line', 0)
                k_end = k.get('end_line', 0)
                if k_start <= c_start and k_end >= c_end and (k_start != 0 or k_end != 0):
                    # c is fully contained in k — skip
                    dominated = True
                    break
            if not dominated:
                kept.append(c)
        result.extend(kept)

    # Restore original ordering (by final_score desc if present, else by similarity)
    result.sort(
        key=lambda x: x.get('final_score', x.get('similarity', 0)),
        reverse=True,
    )
    return result


def _dedup_content(chunks: list[dict]) -> list[dict]:
    """
    Remove chunks with duplicate or near-duplicate content.
    Uses a hash of the first 200 chars of content as a fingerprint.
    """
    seen = set()
    result = []
    for c in chunks:
        content = c.get('content', '')
        fingerprint = content[:200].strip()
        if fingerprint not in seen:
            seen.add(fingerprint)
            result.append(c)
    return result


def build_context(repository_name: str, chunks: list[dict]) -> str:
    """
    Format a list of retrieved chunks into a structured context block for Gemini.

    Format:
        REPOSITORY: {name}

        SOURCE 1
        File: backend/authentication/views.py
        Symbol: GoogleAuthView.post
        Type: method
        Lines: 25-87

        CODE:
        ```
        ...source code...
        ```

        SOURCE 2
        ...

    Processing:
    1. Remove overlapping ranges within each file.
    2. Remove duplicate content.
    3. Re-sort by relevance score (final_score > similarity > 0).
    4. Build blocks up to MAX_CONTEXT_CHARS.
    """
    if not chunks:
        return ''

    # Deduplicate and clean
    cleaned = _strip_overlapping(chunks)
    cleaned = _dedup_content(cleaned)
    cleaned = cleaned[:MAX_SOURCES]

    header = f'REPOSITORY: {repository_name}'
    lines = [header, '']

    total_chars = len(header) + 2
    source_idx = 1

    for chunk in cleaned:
        fp = chunk.get('file_path', '')
        sym = chunk.get('symbol_name', '')
        cls = chunk.get('class_name', '')
        sym_type = chunk.get('symbol_type', 'block')
        start = chunk.get('start_line', 0)
        end = chunk.get('end_line', 0)
        content = chunk.get('content', '')

        # Trim content to per-source cap
        if len(content) > MAX_SOURCE_CHARS:
            content = content[:MAX_SOURCE_CHARS] + '\n... (truncated)'

        # Phase 3: commit-type sources use a different format
        if sym_type == 'commit':
            commit_sha = chunk.get('commit_sha', sym)
            author = chunk.get('author_name', 'Unknown')
            date = chunk.get('committed_date', '')
            if isinstance(date, str) and len(date) > 10:
                date = date[:10]

            block_parts = [
                f'SOURCE {source_idx}',
                'Type: git_commit',
                f'SHA: {commit_sha[:7]}',
                f'Author: {author}',
                f'Date: {date}',
                '',
                'COMMIT MESSAGE:',
            ]
            # Split content: first part is commit header (already formatted), rest is body
            block_parts.append(content)
            block_parts.append('')
        else:
            block_parts = [f'SOURCE {source_idx}', f'File: {fp}']

            if sym:
                block_parts.append(f'Symbol: {sym}')
            elif cls:
                block_parts.append(f'Class: {cls}')

            block_parts.append(f'Type: {sym_type}')

            if start and end:
                block_parts.append(f'Lines: {start}-{end}')

            block_parts.append('')
            block_parts.append('CODE:')
            block_parts.append(f'```\n{content}\n```')
            block_parts.append('')

        block = '\n'.join(block_parts)

        if total_chars + len(block) > MAX_CONTEXT_CHARS:
            break

        lines.append(block)
        total_chars += len(block)
        source_idx += 1

    return '\n'.join(lines)


def format_sources(chunks: list[dict]) -> list[dict]:
    """
    Convert raw chunk dicts into the source reference format returned in the API response
    and stored in ChatMessage.sources.

    Phase 2.1: includes class_name, final_score, semantic_score for richer source cards.
    """
    sources = []
    for c in chunks:
        source = {
            'file_path':        c['file_path'],
            'symbol_name':      c.get('symbol_name', ''),
            'class_name':       c.get('class_name', ''),
            'symbol_type':      c.get('symbol_type', 'block'),
            'start_line':       c.get('start_line', 0),
            'end_line':         c.get('end_line', 0),
        }
        # Phase 3: include commit-specific fields
        if c.get('symbol_type') == 'commit':
            source['commit_sha'] = c.get('commit_sha', '')
            source['author_name'] = c.get('author_name', '')
            source['committed_date'] = c.get('committed_date', '')
        sources.append(source)
    return sources
