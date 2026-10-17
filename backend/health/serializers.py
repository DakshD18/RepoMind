"""
REST Framework Serializers for Health Dashboard (Phase 5).
"""

from rest_framework import serializers
from .models import RepositoryHealthSnapshot, HealthFinding


class HealthFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthFinding
        fields = [
            'id',
            'finding_type',
            'category',
            'severity',
            'title',
            'description',
            'file_path',
            'start_line',
            'end_line',
            'symbol_name',
            'evidence',
            'recommendation',
            'estimated_effort',
            'is_effort_estimate',
            'is_ai_inferred',
            'fingerprint',
            'created_at',
        ]


class RepositoryHealthSnapshotSerializer(serializers.ModelSerializer):
    repository_id = serializers.IntegerField(source='repository.id', read_only=True)
    repository_name = serializers.CharField(source='repository.name', read_only=True)

    class Meta:
        model = RepositoryHealthSnapshot
        fields = [
            'id',
            'repository_id',
            'repository_name',
            'commit_sha',
            'overall_score',
            'grade',
            'component_scores',
            'metrics_summary',
            'findings_summary',
            'file_metrics',
            'ai_summary',
            'ai_summary_available',
            'ai_recommended_actions',
            'created_at',
        ]


class HealthTrendsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepositoryHealthSnapshot
        fields = [
            'id',
            'commit_sha',
            'overall_score',
            'grade',
            'component_scores',
            'findings_summary',
            'created_at',
        ]
