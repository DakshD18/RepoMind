"""
Optional Gemini AI Advisory for Impact Analysis.

Provides qualitative runtime consequence insights strictly distinguished
from the statically verified dependency graph.
Gracefully degrades if Gemini API key is absent or unreachable.
"""

import os
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

ADVISORY_PROMPT = """\
You are an Impact Analysis advisor in RepoMind.
Below is the statically verified dependency impact for a file in a repository:

Target File: {target_file} (Language: {language})
Direct Dependents: {direct_count} ({direct_files})
Transitive Dependents: {transitive_count}
Max Depth: {max_depth}
Calculated Risk Level: {risk_level} (Score: {risk_score}/100)
Risk Factors: {factors}

Task:
Provide a concise (2 to 3 sentences maximum) qualitative advisory for developers modifying this file.
Highlight potential subtle runtime consequences (e.g., interface contract breaks, database migrations, state desynchronization, serializer alignment).
Keep it pragmatic, objective, and specific to the affected files listed.
Do NOT repeat the numbers or risk score.
"""


def _get_gemini_client() -> Tuple[Optional[Any], str]:
    """Helper to initialize Gemini client from environment."""
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    model_name = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
    if not api_key:
        return None, model_name
    try:
        from google import genai
        return genai.Client(api_key=api_key), model_name
    except Exception as e:
        logger.debug("google.genai Client init failed: %s", e)
        return None, model_name


def generate_ai_advisory(impact_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an optional Gemini AI advisory based on static impact data.
    Returns graceful fallback if Gemini is unavailable.
    """
    disclaimer = (
        "AI-inferred runtime advisory based on static dependency context. "
        "Risk scores and consequences are heuristic estimates; verify with tests."
    )

    try:
        client, model_name = _get_gemini_client()
        if not client:
            return {
                'available': False,
                'disclaimer': disclaimer,
                'insight': None,
            }

        target_file = impact_data['target_file']
        target_meta = impact_data.get('target_metadata', {})
        summary = impact_data.get('summary', {})
        risk = impact_data.get('risk_assessment', {})
        direct_files = [d['file_path'] for d in impact_data.get('direct_dependents', [])[:5]]

        prompt = ADVISORY_PROMPT.format(
            target_file=target_file,
            language=target_meta.get('language', 'unknown'),
            direct_count=summary.get('direct_dependent_count', 0),
            direct_files=", ".join(direct_files) or "None",
            transitive_count=summary.get('transitive_dependent_count', 0),
            max_depth=summary.get('max_depth', 0),
            risk_level=risk.get('level', 'LOW'),
            risk_score=risk.get('score', 0),
            factors="; ".join(risk.get('reasons', [])),
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )

        if response and hasattr(response, 'text') and response.text:
            return {
                'available': True,
                'disclaimer': disclaimer,
                'insight': response.text.strip(),
            }
    except Exception as e:
        logger.info("Optional AI advisory unavailable: %s", e)

    return {
        'available': False,
        'disclaimer': disclaimer,
        'insight': None,
    }
