"""
Context Builder (Phase 2).

Converts retrieved code chunks into a structured text block that Gemini
can reason over. Each chunk is clearly labelled with repository name,
file path, symbol, line range, and the source code.
"""

MAX_CONTEXT_CHARS = 12_000   # Total context cap to avoid Gemini input limits


def build_context(repository_name: str, chunks: list[dict]) -> str:
    """
    Format a list of retrieved chunks into structured context for the LLM.

    Example output:
        Repository: ecommerce-app

        --- FILE: src/auth/AuthService.ts ---
        Symbol: login (method)  |  Lines: 24–57
        ```
        export async login(credentials) { ... }
        ```

        --- FILE: src/auth/JWTService.ts ---
        Symbol: generateToken (function)  |  Lines: 12–31
        ```
        function generateToken(payload) { ... }
        ```
    """
    if not chunks:
        return ''

    lines = [f'Repository: {repository_name}', '']

    total_chars = 0
    for chunk in chunks:
        header = f"--- FILE: {chunk['file_path']} ---"

        meta_parts = []
        if chunk.get('symbol_name'):
            sym_type = chunk.get('symbol_type', 'symbol')
            meta_parts.append(f"Symbol: {chunk['symbol_name']} ({sym_type})")
        if chunk.get('start_line') and chunk.get('end_line'):
            meta_parts.append(f"Lines: {chunk['start_line']}–{chunk['end_line']}")

        content = chunk.get('content', '')

        block = header + '\n'
        if meta_parts:
            block += '  '.join(meta_parts) + '\n'
        block += f'```\n{content}\n```\n'

        if total_chars + len(block) > MAX_CONTEXT_CHARS:
            break

        lines.append(block)
        total_chars += len(block)

    return '\n'.join(lines)


def format_sources(chunks: list[dict]) -> list[dict]:
    """
    Convert raw chunk dicts into the source reference format returned in the API response
    and stored in ChatMessage.sources.
    """
    return [
        {
            'file_path': c['file_path'],
            'symbol_name': c.get('symbol_name', ''),
            'symbol_type': c.get('symbol_type', 'block'),
            'start_line': c.get('start_line', 0),
            'end_line': c.get('end_line', 0),
        }
        for c in chunks
    ]
