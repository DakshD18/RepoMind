"""
Grounded AI Health Summary Service for RepoMind Phase 5.

Generates an executive diagnosis and prioritized remediation roadmap.
Strictly grounded in deterministic facts produced by the health scanner.
Handles missing API keys and model errors gracefully with a deterministic fallback.
"""

import json
import logging
import os
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert Repository Health and Technical Debt advisor built into RepoMind.
Your task is to analyze the STATICALLY MEASURED repository health metrics and prioritized findings provided below.

Strict Anti-Hallucination & Grounding Rules:
1. Treat the provided metrics and findings as the ONLY source of truth.
2. NEVER invent files, functions, lines, coverage percentages, or issues not listed in the input.
3. If test coverage is reported as UNAVAILABLE, state that no coverage report was found; do NOT claim coverage is 0%.
4. Do NOT claim runtime crashes unless a syntax error was explicitly reported.
5. Provide a concise executive summary (2 to 3 sentences).
6. Recommend 2 to 4 prioritized, actionable remediation steps for developers ("What to fix first").
7. Output valid JSON in the exact schema specified.

Output JSON format:
{
  "executive_summary": "string",
  "recommended_actions": [
    {
      "step": 1,
      "action": "Brief action title (e.g., 'Refactor function_name in path/file.py')",
      "reason": "Why this should be prioritized (e.g. cyclomatic complexity of 24 increases regression risk)",
      "affected_files": ["path/file.py"],
      "estimated_effort": "QUICK_FIX" | "MODERATE" | "SIGNIFICANT"
    }
  ]
}
"""


def _get_gemini_client() -> Tuple[Optional[Any], str]:
    """Initialize Gemini client from environment variables."""
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    model_name = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
    if not api_key:
        return None, model_name
    try:
        from google import genai
        return genai.Client(api_key=api_key), model_name
    except Exception as e:
        logger.debug("Failed initializing google.genai Client: %s", e)
        return None, model_name


def generate_deterministic_fallback_summary(
    overall_score: float,
    grade: str,
    component_scores: dict,
    findings: List[dict],
) -> Dict[str, Any]:
    """
    Generate a helpful, grounded fallback summary when Gemini is unavailable or not configured.
    """
    top_findings = sorted(
        findings,
        key=lambda f: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}.get(f.get('severity', 'INFO'), 5)
    )[:4]

    actions = []
    for idx, f in enumerate(top_findings, start=1):
        actions.append({
            'step': idx,
            'action': f.get('title', 'Address flagged technical debt'),
            'reason': f.get('description', 'High impact on repository maintainability.'),
            'affected_files': [f['file_path']] if f.get('file_path') else [],
            'estimated_effort': f.get('estimated_effort', 'MODERATE'),
        })

    weakest_comp = min(component_scores.items(), key=lambda kv: kv[1])[0] if component_scores else 'complexity'
    exec_summary = (
        f"Repository Health is rated {overall_score:.1f}/100 ({grade}). "
        f"The primary maintainability friction is concentrated in '{weakest_comp.replace('_', ' ').capitalize()}', "
        f"with {len(findings)} total prioritized technical debt findings detected across the codebase."
    )

    return {
        'available': False,
        'executive_summary': exec_summary,
        'recommended_actions': actions,
        'disclaimer': "Deterministic synthesis based on static findings (Gemini API key not configured or offline).",
    }


def generate_ai_health_summary(
    overall_score: float,
    grade: str,
    component_scores: dict,
    metrics_summary: dict,
    findings: List[dict],
) -> Dict[str, Any]:
    """
    Generate an AI health summary using Gemini with deterministic fallback.
    """
    disclaimer = "AI synthesis strictly grounded in statically measured repository metrics. Effort values are estimates."

    client, model_name = _get_gemini_client()
    if not client:
        res = generate_deterministic_fallback_summary(overall_score, grade, component_scores, findings)
        res['disclaimer'] = disclaimer
        return res

    # Format factual input
    top_findings_for_prompt = findings[:12]  # Cap prompt context
    payload = {
        'overall_score': overall_score,
        'grade': grade,
        'component_scores': component_scores,
        'metrics_summary': metrics_summary,
        'top_findings': [
            {
                'severity': f.get('severity'),
                'category': f.get('category'),
                'title': f.get('title'),
                'file_path': f.get('file_path'),
                'symbol_name': f.get('symbol_name'),
                'evidence': f.get('evidence'),
            }
            for f in top_findings_for_prompt
        ],
    }

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"INPUT FACTS (JSON):\n{json.dumps(payload, indent=2)}\n\n"
        f"Respond with JSON ONLY:"
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )

        if response and hasattr(response, 'text') and response.text:
            cleaned = response.text.strip()
            # Strip markdown ```json code blocks if present
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                if cleaned.endswith('```'):
                    cleaned = cleaned.rsplit('\n', 1)[0]
                cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            return {
                'available': True,
                'executive_summary': parsed.get('executive_summary', ''),
                'recommended_actions': parsed.get('recommended_actions', []),
                'disclaimer': disclaimer,
            }
    except Exception as e:
        logger.info("Gemini AI health summary generation failed, falling back to deterministic: %s", e)

    fallback = generate_deterministic_fallback_summary(overall_score, grade, component_scores, findings)
    fallback['disclaimer'] = disclaimer
    return fallback
