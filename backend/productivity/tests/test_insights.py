"""
Tests for Grounded AI Productivity Insights (Phase 6).
"""

from unittest.mock import MagicMock, patch
from django.test import TestCase

from productivity.services.ai_insights import (
    generate_productivity_insights,
    generate_deterministic_fallback_insights,
)


class ProductivityInsightsTests(TestCase):
    def setUp(self):
        self.sample_analytics = {
            'repository_id': 1,
            'repository_name': 'RepoMind',
            'time_range': '30d',
            'overview': {
                'total_commits': 42,
                'active_contributors': 3,
                'files_modified': 12,
                'lines_added': 850,
                'lines_deleted': 200,
                'net_line_change': 650,
                'total_churn_volume': 1050,
                'stats_available': True,
                'active_days_count': 14,
                'avg_commits_per_active_day': 3.0,
                'previous_period': {
                    'has_previous_data': True,
                    'previous_commits': 30,
                    'commits_delta_pct': 40.0,
                },
            },
            'hotspots': [
                {
                    'file_path': 'backend/rag/llm_service.py',
                    'module': 'backend/rag',
                    'commit_count': 8,
                    'contributor_count': 2,
                    'total_churn': 450,
                    'activity_label': 'Frequently modified',
                }
            ],
            'modules': [
                {
                    'module_path': 'backend/rag',
                    'commit_count': 15,
                    'file_count': 4,
                    'contributor_count': 1,
                    'single_contributor_period': True,
                    'contributors': ['Alice Smith'],
                }
            ],
            'contributors': [
                {
                    'display_name': 'Alice Smith',
                    'commit_count': 25,
                    'files_modified_count': 8,
                    'lines_added': 500,
                    'lines_deleted': 100,
                }
            ],
            'knowledge_distribution': {
                'total_active_contributors': 3,
                'single_contributor_modules_count': 1,
                'shared_modules_count': 2,
                'top_contributor_commit_share_pct': 59.5,
            },
            'data_availability': {
                'limitations_note': 'Analytics reflect 42 commits ingested in 30d.',
            },
        }

    def test_deterministic_fallback_synthesis(self):
        """When Gemini is offline or unconfigured, fallback must synthesize actual measured facts."""
        res = generate_deterministic_fallback_insights(self.sample_analytics)
        self.assertFalse(res['ai_generated'])
        self.assertEqual(res['model'], 'deterministic_fallback')
        self.assertIn('42 commits', res['overall_pattern'])
        self.assertIn('1,050 lines', res['code_churn_dynamics'])
        self.assertIn('backend/rag/llm_service.py', res['hotspots_and_modules'])
        self.assertTrue(len(res['areas_for_review']) > 0)
        self.assertIn('deterministic fallback applied', res['data_limitations'])

    @patch('productivity.services.ai_insights._get_gemini_client')
    def test_gemini_insights_grounded(self, mock_client_getter):
        """When Gemini is active, response must parse into structured JSON schema."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '''{
            "overall_pattern": "Active feature development with 42 commits over the past 30 days.",
            "timeline_trends": "Commit activity increased by 40% over the previous period.",
            "hotspots_and_modules": "Revisions were concentrated in backend/rag.",
            "code_churn_dynamics": "High churn volume of 1,050 lines with 650 net line additions.",
            "collaboration_and_distribution": "3 active contributors with backend/rag modified primarily by one author.",
            "areas_for_review": [
                {
                    "title": "Review llm_service.py changes",
                    "reason": "450 lines changed across 8 commits",
                    "affected_path": "backend/rag/llm_service.py"
                }
            ],
            "data_limitations": "Limited to 42 commits recorded in the 30d window."
        }'''
        mock_client.models.generate_content.return_value = mock_response
        mock_client_getter.return_value = (mock_client, 'gemini-2.5-flash')

        res = generate_productivity_insights(self.sample_analytics)
        self.assertTrue(res['ai_generated'])
        self.assertEqual(res['model'], 'gemini-2.5-flash')
        self.assertIn('42 commits', res['overall_pattern'])
        self.assertEqual(len(res['areas_for_review']), 1)
        self.assertEqual(res['areas_for_review'][0]['affected_path'], 'backend/rag/llm_service.py')
