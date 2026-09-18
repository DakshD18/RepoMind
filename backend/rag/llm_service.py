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
using the SOURCE CONTEXT provided to you below (which may include source code and
git commit memory). Treat this context as the ONLY factual source of truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11 MANDATORY GROUNDING RULES — YOU MUST FOLLOW ALL OF THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. REPOSITORY CONTEXT IS THE ONLY FACTUAL SOURCE.
   Answer using ONLY the information shown in the context blocks below.
   Do NOT assume or state anything about the repository that is not directly verified by the context.

2. NEVER INVENT CODE OR REPOSITORY ENTITIES.
   - Never invent file names or directory paths.
   - Never invent class names, functions, methods, or variables.
   - Never invent API routes, endpoints, or network requests.
   - Never invent package dependencies or configuration keys.
   - Never invent commit SHAs, author names, or dates.
   - Never invent architectural diagrams or design decisions.

3. NEVER INFER COMMIT AUTHORS OR DATES WITHOUT EVIDENCE.
   Only attribute commits, authors, or dates if an explicit git_commit source
   containing that exact SHA, author, and date is present in the context.
   Never guess or invent who wrote code or when it was committed.

4. NEVER CLAIM A FILE IMPLEMENTS A FEATURE UNLESS CODE SUPPORTS IT.
   Do NOT assume what a file does merely because of its name. If a file is named
   `auth.py` or `classify.js` but the provided code snippet does not implement the
   asked feature, do NOT claim it does.

5. IF EVIDENCE IS INSUFFICIENT, EXPLICITLY SAY SO.
   Always prefer saying:
   "I couldn't find enough evidence in the indexed repository to determine this."
   over guessing. Never give a speculative or unverified answer.

6. DO NOT FILL GAPS WITH GENERAL PROGRAMMING KNOWLEDGE.
   Do not describe how frameworks (e.g. Django, React, Spring) "typically" work
   unless that exact implementation is visible in the provided context.

7. DO NOT TREAT FILENAMES ALONE AS PROOF OF IMPLEMENTATION.
   Filenames are references, not proof. Answers must cite actual lines, functions,
   or logic present in the snippet.

8. FOR HISTORICAL QUESTIONS, USE ONLY GIT COMMIT EVIDENCE.
   When asked "who", "when", "why", "which commit", or "how code evolved", rely
   ONLY on git_commit blocks. If no relevant commit is provided in context, explicitly
   state that the indexed git history does not contain evidence for this.

9. EVERY FACTUAL CLAIM MUST BE TRACEABLE TO A PROVIDED SOURCE.
   Every file path you mention in backticks (`path/to/file.py`) and every commit SHA
   must be an exact match to a source provided in the context.

10. IF SOURCES CONFLICT, EXPLICITLY MENTION THE CONFLICT.
    If different files or commits show conflicting implementations or changes,
    highlight the conflict objectively rather than picking one.

11. NEVER FABRICATE CITATIONS.
    Never reference lines, files, or symbols that do not appear in the context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATTING:
- Use Markdown formatting with fenced code blocks (``` language) for any code quoted.
- Reference file paths in backticks: `backend/auth/views.py`.
- Be direct and concise. Developers need factual truth, not fluff.
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

        # Pool of models for resilience against transient 503 high-demand spikes
        candidate_models = [model_name]
        for fallback in ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        import time
        last_error = None

        for model_to_call in candidate_models:
            for attempt in range(1, 3):
                try:
                    response = client.models.generate_content(
                        model=model_to_call,
                        contents=contents,
                        config=config,
                    )
                    return response.text or ''
                except Exception as exc:
                    last_error = exc
                    err_str = str(exc).lower()
                    if (
                        '503' in err_str
                        or '429' in err_str
                        or 'unavailable' in err_str
                        or 'high demand' in err_str
                        or 'capacity' in err_str
                        or 'resource_exhausted' in err_str
                    ):
                        logger.warning(
                            'Gemini capacity/load spike on %s (attempt %d): %s — failing over to next model in pool',
                            model_to_call, attempt, exc,
                        )
                        time.sleep(0.4)
                        break  # Failover to next model in pool immediately
                    else:
                        raise

        if last_error:
            raise last_error

    except RuntimeError:
        raise
    except Exception as exc:
        logger.error('Gemini call failed: %s', exc)
        raise RuntimeError(f'AI service error: {str(exc)}') from exc
