from rest_framework import serializers
from .models import Repository


class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = [
            'id', 'url', 'name', 'owner', 'default_branch', 'branches',
            'languages', 'file_count', 'folder_count', 'last_commit_date',
            'description', 'recent_commits',
            'status', 'error_message',
            'is_indexed', 'index_status', 'index_error',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'name', 'owner', 'default_branch', 'branches', 'languages',
            'file_count', 'folder_count', 'last_commit_date',
            'description', 'recent_commits',
            'status', 'error_message',
            'is_indexed', 'index_status', 'index_error',
            'created_at', 'updated_at',
        ]



class AnalyseRepositorySerializer(serializers.Serializer):
    url = serializers.URLField()

    def validate_url(self, value):
        """Ensure the URL is a valid GitHub repository URL."""
        if 'github.com' not in value:
            raise serializers.ValidationError(
                'Only GitHub repository URLs are supported at this time.'
            )
        return value.rstrip('/')
