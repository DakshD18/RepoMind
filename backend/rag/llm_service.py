"""
Gemini LLM Service (Phase 2.1 — RAG Accuracy Upgrade).

Phase 2.1 changes:
- Strictly upgraded system prompt with explicit anti-hallucination constraints.
- Gemini is instructed to:
    • Treat retrieved context as the ONLY source of truth.
    • Never invent files, functions, APIs, classes, or dependencies.
    • Distinguish clearly between facts shown in the code and reasonable inferences.
    • State explicitly when context is insufficient.
    • Never use generic framework knowledge to fill gaps not shown in the retrieved code.
- Repository name and the source file list are included in the system context to
  ensure every answer reference maps to a real retrieved chunk.
- temperature stays at 0.15 for deterministic, grounded answers.
"""

import logging
import os

logger = logging.getLogger(__name__)

# ─── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a Repository Intelligence assistant built into RepoMind.

Your ONLY job is to answer developer questions about a specific GitHub repository
using the SOURCE CODE CONTEXT provided to you below. The context contains actual
code retrieved from the repository — treat it as ground truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — YOU MUST FOLLOW ALL OF THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. USE ONLY THE RETRIEVED CONTEXT.
   Answer using ONLY the source code shown in the context block.
   Do NOT use your general knowledge of frameworks, libraries, or common patterns
   to fill in gaps that are not visible in the provided code.

2. DO NOT INVENT CODE.
   - Do NOT invent file names.
   - Do NOT invent function names, class names, or method names.
   - Do NOT invent API routes or endpoints.
   - Do NOT invent package dependencies.
   - Do NOT invent architecture or design decisions.
   - Do NOT describe how something "typically works" unless the context shows it.

3. CITE REAL SOURCES.
   Every code reference in your answer must correspond to a FILE and SYMBOL
   actually shown in the retrieved context. Use the exact file path and symbol
   name as shown.

4. DISTINGUISH FACTS FROM INFERENCES.
   If you make a reasonable inference beyond what the code explicitly shows,
   mark it clearly: "(inferred)" or "(not explicitly shown in retrieved code)".

5. STATE WHEN CONTEXT IS INSUFFICIENT.
   If the retrieved context does not contain enough information to answer the
   question confidently, say:
   "I couldn't find enough relevant information in the retrieved context to
    answer this question confidently. The indexed code may not include the
    relevant files, or the repository may need to be re-indexed."

6. DO NOT ASSUME HISTORICAL REASONS.
   Do not speculate about WHY an architectural decision was made unless the
   code (e.g. comments, README) explicitly explains it.

7. FORMAT CLEARLY.
   - Use Markdown formatting.
   - Use fenced code blocks (``` language) for any code you quote.
   - Reference file paths in backticks: `backend/auth/views.py`.
   - Be concise. Developers need accurate answers, not long disclaimers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


def call_gemini(
    system_context: str,
    conversation_history: list[dict],
    user_question: str,
) -> str:
    """
    Call Gemini with the repository context and conversation history.

    Args:
        system_context: Structured repository context from the context builder.
                        Includes REPOSITORY header + SOURCE N blocks.
        conversation_history: List of {'role': 'user'|'model', 'parts': [str]}
                              representing prior conversation turns.
        user_question: The user's current question (verbatim).

    Returns:
        The generated text response from Gemini.

    Raises:
        RuntimeError: if API key is missing or the Gemini call fails.
    """
    api_key    = os.getenv('GEMINI_API_KEY', '').strip()
    model_name = os.getenv('GEMINI_MODEL', 'gemini-3.6-flash')

    if not api_key:
        raise RuntimeError(
            'GEMINI_API_KEY is not configured. Please add it to backend/.env.'
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Full prompt for the current turn:
        # [Retrieved Repository Context]
        # ---
        # User Question: <question>
        current_user_turn = (
            f'{system_context}\n\n'
            f'---\n\n'
            f'User Question: {user_question}'
        )

        # Assemble conversation contents (history + current turn)
        contents = []
        for msg in conversation_history:
            contents.append(
                types.Content(
                    role=msg['role'],
                    parts=[types.Part(text=msg['parts'][0])],
                )
            )
        contents.append(
            types.Content(
                role='user',
                parts=[types.Part(text=current_user_turn)],
            )
        )

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.15,       # Low for deterministic, grounded answers
            max_output_tokens=2048,
        )

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config,
        )

        return response.text or ''

    except RuntimeError:
        raise
    except Exception as exc:
        logger.error('Gemini call failed: %s', exc)
        raise RuntimeError(f'AI service error: {str(exc)}') from exc
