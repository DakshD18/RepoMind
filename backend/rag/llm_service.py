"""
Gemini LLM Service (Phase 2).

Wraps the google-genai SDK (the new, non-deprecated package).
Credentials stay on the backend — never exposed to the frontend.

System prompt enforces strict grounding:
- Gemini MUST answer using the provided repository context.
- Gemini MUST NOT invent files, functions, APIs, or implementation details.
- Gemini MUST clearly state when the retrieved context is insufficient.
"""

import logging
import os

logger = logging.getLogger(__name__)

# System prompt — defines Gemini's role and grounding rules
SYSTEM_PROMPT = """You are a repository intelligence assistant for the RepoMind platform.

Your job is to answer developer questions about a specific GitHub repository based ONLY on the source code context provided to you.

STRICT RULES:
1. Use ONLY the repository code context provided. Do not invent or assume any code, files, APIs, or implementations that are not shown in the context.
2. If the retrieved context is insufficient or does not contain enough information to answer confidently, say exactly that. For example: "The current context does not contain enough information to answer this question. You may want to ask a more specific question or index a different part of the repository."
3. Do not use general knowledge about frameworks or libraries to fill gaps in the repository context. Describe what you actually see in the provided code.
4. When citing code, reference the actual file paths and symbol names visible in the context.
5. Format your answers clearly using Markdown. Use code blocks for any code you reference.
6. Be concise but complete. Developers need accurate, source-grounded answers.
"""


def call_gemini(
    system_context: str,
    conversation_history: list[dict],
    user_question: str,
) -> str:
    """
    Call Gemini with the repository context and conversation history.

    Args:
        system_context: The formatted repository context from the context builder.
        conversation_history: List of {'role': 'user'|'model', 'parts': [str]} dicts
                              representing the conversation so far.
        user_question: The user's current question.

    Returns:
        The generated text response from Gemini.

    Raises:
        RuntimeError: if Gemini API key is missing or the call fails.
    """
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    model_name = os.getenv('GEMINI_MODEL', 'gemini-3.6-flash')

    if not api_key:
        raise RuntimeError(
            'GEMINI_API_KEY is not configured. Please add it to backend/.env to enable AI chat.'
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Build the full prompt for the current turn:
        # [System grounding prompt] + [Repository context] + [User question]
        current_user_turn = (
            f'{system_context}\n\n'
            f'---\n\nUser Question:\n{user_question}'
        )

        # Assemble conversation contents
        contents = []
        for msg in conversation_history:
            contents.append(
                types.Content(
                    role=msg['role'],
                    parts=[types.Part(text=msg['parts'][0])],
                )
            )

        # Add current turn
        contents.append(
            types.Content(
                role='user',
                parts=[types.Part(text=current_user_turn)],
            )
        )

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,    # Low temperature for deterministic, grounded answers
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
