"""
AI Productivity Insights Service (Phase 6 — Productivity Intelligence).

Generates grounded development activity insights using Google Gemini,
grounded exclusively in statically calculated Git analytics.
Includes a deterministic fallback when Gemini is unavailable or not configured.
"""

import json
import logging
import os
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert Repository Intelligence advisor built into RepoMind.
Your task is to analyze the CALCULATED repository productivity and activity analytics provided below.

Strict Anti-Hallucination & Grounding Rules:
1. Treat the provided metrics as the ONLY source of truth.
2. NEVER invent commit counts, file paths, author names, time ranges, or statistics.
3. This is an objective repository analytics feature, NOT an employee surveillance or developer-evaluation tool.
   - Do NOT judge individuals as lazy, fast, inefficient, or top/bottom performers.
   - Do NOT interpret commit counts or lines of code as developer productivity or quality.
   - Present contributor activity as neutral historical participation.
4. Distinguish clearly between observed facts (e.g., "5 commits touched auth.py") and hypotheses (e.g., "active refinement or feature iteration").
5. Clearly explain the difference between net line change and total code churn when relevant.
6. If a module has only one observed contributor in the period, describe it cautiously as "single observed contributor in the selected window", NOT as a failure or total bus-factor crisis.
7. Explicitly state the data limitations and time window analyzed.
8. Output valid JSON in the exact schema specified below.

Output JSON format:
{
  "overall_pattern": "string (2-3 sentences summarizing activity level, commit volume, and timeframe)",
  "timeline_trends": "string (notable activity velocity, peak periods, or comparison with previous window)",
  "hotspots_and_modules": "string (frequently modified files and concentrated modules with context)",
  "code_churn_dynamics": "string (net code change vs total churn volume observations)",
  "collaboration_and_distribution": "string (neutral observation of collaboration across modules)",
  "areas_for_review": [
    {
      "title": "string (e.g., 'Review high churn in path/to/file')",
      "reason": "string (e.g., '450 lines changed across 6 commits by 2 contributors')",
      "affected_path": "string"
    }
  ],
  "data_limitations": "string (explicit statement of analyzed commit count, time range, and stats availability)"
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


def generate_deterministic_fallback_insights(analytics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an objective, grounded fallback summary when Gemini is unavailable.
    Synthesizes exact facts from the calculated analytics payload.
    """
    ov = analytics.get('overview', {})
    time_range = analytics.get('time_range', 'selected period')
    total_commits = ov.get('total_commits', 0)
    active_contributors = ov.get('active_contributors', 0)
    files_modified = ov.get('files_modified', 0)
    lines_added = ov.get('lines_added', 0)
    lines_deleted = ov.get('lines_deleted', 0)
    net_change = ov.get('net_line_change', 0)
    total_churn = ov.get('total_churn_volume', 0)

    hotspots = analytics.get('hotspots', [])[:5]
    modules = analytics.get('modules', [])[:5]
    prev = ov.get('previous_period', {})
    has_prev = prev.get('has_previous_data', False)

    # 1. Overall pattern
    if total_commits == 0:
        overall_pattern = f"No commits were recorded in the repository during the {time_range} window."
    else:
        overall_pattern = (
            f"During the {time_range} period, {total_commits} commits were recorded across {files_modified} files "
            f"by {active_contributors} active contributor{'s' if active_contributors != 1 else ''}. "
            f"Development activity averaged {ov.get('avg_commits_per_active_day', 0)} commits per active day."
        )

    # 2. Timeline trends
    if has_prev and prev.get('commits_delta_pct') is not None:
        delta = prev['commits_delta_pct']
        direction = "increased" if delta > 0 else "decreased" if delta < 0 else "remained consistent"
        timeline_trends = (
            f"Commit activity {direction} by {abs(delta):.1f}% compared to the preceding period "
            f"({total_commits} vs {prev.get('previous_commits', 0)} commits)."
        )
    else:
        timeline_trends = (
            f"Recorded activity spans {ov.get('active_days_count', 0)} active days across the selected timeline."
        )

    # 3. Hotspots & Modules
    if hotspots:
        top_h = hotspots[0]
        top_m = modules[0] if modules else None
        mod_text = f" Concentrated attention was observed in module '{top_m['module_path']}' ({top_m['commit_count']} commits)." if top_m else ""
        hotspots_and_modules = (
            f"The most frequently modified file was '{top_h['file_path']}' with {top_h['commit_count']} touches. "
            f"{mod_text}"
        )
    else:
        hotspots_and_modules = "No file hotspot concentrations were observed in this period."

    # 4. Code churn
    code_churn_dynamics = (
        f"A total change volume of {total_churn:,} lines was recorded (+{lines_added:,} additions, -{lines_deleted:,} deletions), "
        f"resulting in a net change of {'+' if net_change > 0 else ''}{net_change:,} lines. "
        f"Code churn exceeds net change, indicating ongoing code refinement and restructuring alongside growth."
        if total_churn > 0 else
        "No diff churn statistics were available for this period."
    )

    # 5. Collaboration & Distribution
    kd = analytics.get('knowledge_distribution', {})
    single_mods = kd.get('single_contributor_modules_count', 0)
    collab_text = (
        f"Activity involved {active_contributors} observed contributor{'s' if active_contributors != 1 else ''}. "
        f"{single_mods} module{'s' if single_mods != 1 else ''} had a single observed contributor in the selected window; "
        "this reflects recent commit focus rather than sole application ownership."
    )

    # 6. Areas for review
    areas = []
    for h in hotspots[:3]:
        if h.get('total_churn', 0) > 100 or h.get('commit_count', 0) >= 3:
            areas.append({
                'title': f"Review change patterns in {h['file_path']}",
                'reason': f"{h['commit_count']} commits and {h['total_churn']:,} lines of churn by {h['contributor_count']} contributor(s).",
                'affected_path': h['file_path'],
            })
    for m in modules[:2]:
        if m.get('single_contributor_period'):
            areas.append({
                'title': f"Module {m['module_path']} knowledge sharing",
                'reason': f"All {m['commit_count']} commits in the selected window were made by {m['contributors'][0] if m['contributors'] else 'one author'}.",
                'affected_path': m['module_path'],
            })

    # 7. Limitations
    limitations = analytics.get('data_availability', {}).get(
        'limitations_note',
        f"Grounded synthesis based on {total_commits} commits in {time_range}."
    )

    return {
        'ai_generated': False,
        'model': 'deterministic_fallback',
        'overall_pattern': overall_pattern,
        'timeline_trends': timeline_trends,
        'hotspots_and_modules': hotspots_and_modules,
        'code_churn_dynamics': code_churn_dynamics,
        'collaboration_and_distribution': collab_text,
        'areas_for_review': areas[:4],
        'data_limitations': limitations + " (Gemini API offline or not configured; deterministic fallback applied).",
    }


def generate_productivity_insights(analytics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate grounded AI productivity insights using Gemini.
    Falls back gracefully to deterministic synthesis if Gemini fails or is unconfigured.
    """
    client, model_name = _get_gemini_client()
    if not client:
        logger.info("Gemini API key not configured; using deterministic productivity synthesis.")
        return generate_deterministic_fallback_insights(analytics)

    # Prepare structured input payload for Gemini
    prompt_payload = {
        'repository_name': analytics.get('repository_name'),
        'time_range': analytics.get('time_range'),
        'overview': analytics.get('overview'),
        'top_hotspots': analytics.get('hotspots', [])[:8],
        'top_modules': analytics.get('modules', [])[:6],
        'top_contributors_summary': [
            {
                'display_name': c['display_name'],
                'commit_count': c['commit_count'],
                'files_modified': c['files_modified_count'],
                'lines_added': c['lines_added'],
                'lines_deleted': c['lines_deleted'],
            }
            for c in analytics.get('contributors', [])[:5]
        ],
        'knowledge_distribution': analytics.get('knowledge_distribution'),
        'data_availability': analytics.get('data_availability'),
    }

    user_prompt = f"Analyze the following calculated repository productivity analytics:\n\n{json.dumps(prompt_payload, indent=2)}"

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[SYSTEM_PROMPT, user_prompt],
            config={
                'temperature': 0.15,
                'response_mime_type': 'application/json',
            },
        )

        raw_text = response.text or '{}'
        data = json.loads(raw_text)

        return {
            'ai_generated': True,
            'model': model_name,
            'overall_pattern': data.get('overall_pattern', ''),
            'timeline_trends': data.get('timeline_trends', ''),
            'hotspots_and_modules': data.get('hotspots_and_modules', ''),
            'code_churn_dynamics': data.get('code_churn_dynamics', ''),
            'collaboration_and_distribution': data.get('collaboration_and_distribution', ''),
            'areas_for_review': data.get('areas_for_review', []),
            'data_limitations': data.get('data_limitations', ''),
        }

    except Exception as exc:
        logger.warning("Gemini productivity insight generation failed: %s; applying fallback.", exc)
        return generate_deterministic_fallback_insights(analytics)
