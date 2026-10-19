"""
Productivity Serializers (Phase 6 — Productivity Intelligence).
"""

from rest_framework import serializers


class ProductivityQueryParamSerializer(serializers.Serializer):
    """Validate query parameters for productivity endpoints."""
    range = serializers.ChoiceField(
        choices=['7d', '30d', '90d', '6m', '12m', 'all', 'custom'],
        default='30d',
        required=False,
    )
    start_date = serializers.CharField(required=False, allow_blank=True)
    end_date = serializers.CharField(required=False, allow_blank=True)
    aggregation = serializers.ChoiceField(
        choices=['daily', 'weekly', 'monthly'],
        default='daily',
        required=False,
    )
    search = serializers.CharField(required=False, allow_blank=True)
    ordering = serializers.ChoiceField(
        choices=['commits', '-commits', 'churn', '-churn', 'recent', '-recent', 'contributors', '-contributors'],
        default='-commits',
        required=False,
    )
    file_path = serializers.CharField(required=False, allow_blank=True)
    page = serializers.IntegerField(default=1, min_value=1, required=False)
    page_size = serializers.IntegerField(default=20, min_value=1, max_value=100, required=False)


class ContributorInsightSerializer(serializers.Serializer):
    contributor_key = serializers.CharField()
    display_name = serializers.CharField()
    email = serializers.CharField()
    commit_count = serializers.IntegerField()
    files_modified_count = serializers.IntegerField()
    lines_added = serializers.IntegerField()
    lines_deleted = serializers.IntegerField()
    net_change = serializers.IntegerField()
    total_churn = serializers.IntegerField()
    first_commit = serializers.CharField(allow_null=True)
    last_commit = serializers.CharField(allow_null=True)
    top_files = serializers.ListField(child=serializers.DictField())
    top_modules = serializers.ListField(child=serializers.DictField())


class FileHotspotSerializer(serializers.Serializer):
    file_path = serializers.CharField()
    module = serializers.CharField()
    commit_count = serializers.IntegerField()
    contributor_count = serializers.IntegerField()
    contributors = serializers.ListField(child=serializers.CharField())
    lines_added = serializers.IntegerField()
    lines_deleted = serializers.IntegerField()
    net_change = serializers.IntegerField()
    total_churn = serializers.IntegerField()
    first_modified = serializers.CharField(allow_null=True)
    last_modified = serializers.CharField(allow_null=True)
    activity_label = serializers.CharField()


class ModuleAnalyticsSerializer(serializers.Serializer):
    module_path = serializers.CharField()
    commit_count = serializers.IntegerField()
    file_count = serializers.IntegerField()
    contributor_count = serializers.IntegerField()
    contributors = serializers.ListField(child=serializers.CharField())
    lines_added = serializers.IntegerField()
    lines_deleted = serializers.IntegerField()
    net_change = serializers.IntegerField()
    total_churn = serializers.IntegerField()
    single_contributor_period = serializers.BooleanField()
    cautious_note = serializers.CharField(allow_null=True, required=False)
    top_files = serializers.ListField(child=serializers.DictField())
