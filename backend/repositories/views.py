"""
Repository Views — Handles analysis submission and repository retrieval.
"""

import os
from pathlib import Path
from django.conf import settings
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Repository
from .serializers import RepositorySerializer, AnalyseRepositorySerializer
from parser.services import clone_repository, extract_metadata


def _parse_github_url(url: str) -> tuple[str, str]:
    """Extract owner and repo name from a GitHub URL."""
    # e.g. https://github.com/owner/repo
    parts = url.replace('https://github.com/', '').split('/')
    if len(parts) < 2:
        raise ValueError('Invalid GitHub URL format.')
    owner = parts[0]
    name = parts[1].replace('.git', '')
    return owner, name


class AnalyseRepositoryView(APIView):
    """
    POST /api/repositories/analyse
    Accepts a GitHub URL, clones the repository, extracts metadata,
    and stores the result.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AnalyseRepositorySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        url = serializer.validated_data['url']

        try:
            owner, name = _parse_github_url(url)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Create a PENDING repository record
        repo_record = Repository.objects.create(
            user=request.user,
            url=url,
            owner=owner,
            name=name,
            status=Repository.Status.PENDING,
        )

        # Set target clone directory
        target_dir = str(settings.CLONED_REPOS_DIR / f"{owner}_{name}_{repo_record.id}")

        # Update status to PROCESSING
        repo_record.status = Repository.Status.PROCESSING
        repo_record.save()

        try:
            # Clone and extract metadata
            git_repo = clone_repository(url, target_dir)
            metadata = extract_metadata(target_dir, git_repo)

            # Parse last commit date
            last_commit_date = None
            if metadata.get('last_commit_date'):
                last_commit_date = parse_datetime(metadata['last_commit_date'])

            # Update the repository record
            repo_record.default_branch = metadata.get('default_branch', '')
            repo_record.branches = metadata.get('branches', [])
            repo_record.languages = metadata.get('languages', [])
            repo_record.file_count = metadata.get('file_count', 0)
            repo_record.folder_count = metadata.get('folder_count', 0)
            repo_record.last_commit_date = last_commit_date
            repo_record.status = Repository.Status.SUCCESS
            repo_record.save()

        except Exception as e:
            repo_record.status = Repository.Status.FAILED
            repo_record.error_message = str(e)
            repo_record.save()
            return Response(
                {'error': f'Failed to analyse repository: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            RepositorySerializer(repo_record).data,
            status=status.HTTP_201_CREATED
        )


class RepositoryListView(APIView):
    """
    GET /api/repositories
    Lists all repositories belonging to the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repos = Repository.objects.filter(user=request.user)
        serializer = RepositorySerializer(repos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RepositoryDetailView(APIView):
    """
    GET /api/repositories/:id
    Retrieves a specific repository by ID (must belong to the current user).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            repo = Repository.objects.get(pk=pk, user=request.user)
        except Repository.DoesNotExist:
            return Response(
                {'error': 'Repository not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = RepositorySerializer(repo)
        return Response(serializer.data, status=status.HTTP_200_OK)
