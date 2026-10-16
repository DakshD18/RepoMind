"""
Views for Phase 4 Impact Analysis.

Enforces:
1. Strict user repository ownership (IsAuthenticated + User FK check).
2. Path traversal security (preventing escaping cloned repo root).
3. Repository-scoped dependency extraction and cache invalidation.
"""

import os
from pathlib import Path
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from repositories.models import Repository
from .resolver import validate_safe_path, SecurityException
from .graph import build_dependency_graph
from .analyzer import analyze_file_impact
from .advisory import generate_ai_advisory


def _get_user_repository(pk: int, user) -> tuple[Repository | None, Path | None, str | None]:
    """
    Validate repository ownership and return Repository instance and local path.
    Returns (repo, repo_dir, error_message).
    """
    try:
        repo = Repository.objects.get(pk=pk, user=user)
    except Repository.DoesNotExist:
        return None, None, "Repository not found."

    repo_dir = settings.CLONED_REPOS_DIR / f"{repo.owner}_{repo.name}_{repo.id}"
    if not repo_dir.exists() or not repo_dir.is_dir():
        return repo, None, "Repository source files are not available locally. Please re-analyse or sync repository first."

    return repo, repo_dir, None


class ImpactFilesView(APIView):
    """
    GET /api/repositories/<pk>/impact/files/
    Returns all analyzable files and suggested hub files for quick selection.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        graph = build_dependency_graph(repo.id, repo_dir)

        # Find top hub files by in-degree (files most imported by others)
        hub_candidates = sorted(
            graph.reverse_graph.keys(),
            key=lambda f: len(graph.reverse_graph.get(f, [])),
            reverse=True,
        )
        suggested = [f for f in hub_candidates if len(graph.reverse_graph.get(f, [])) > 0][:8]

        return Response({
            'repository_id': repo.id,
            'revision': graph.revision,
            'total_files': len(graph.all_files),
            'files': graph.all_files,
            'suggested_files': suggested,
        }, status=status.HTTP_200_OK)


class ImpactAnalysisView(APIView):
    """
    POST /api/repositories/<pk>/impact/
    Body: { "file_path": "backend/api/models.py", "force_rebuild": false }
    Calculates impact of changing the given file.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        file_path = request.data.get('file_path')
        if not file_path or not isinstance(file_path, str) or not file_path.strip():
            return Response(
                {'error': 'A valid "file_path" string is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        force_rebuild = bool(request.data.get('force_rebuild', False))

        # Security check: prevent path traversal outside repo
        try:
            target_full_path = validate_safe_path(repo_dir, file_path)
            normalized_rel_path = str(target_full_path.relative_to(repo_dir))
        except SecurityException as se:
            return Response(
                {'error': f'Security violation: {str(se)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except FileNotFoundError as fe:
            return Response(
                {'error': f'File not found: {str(fe)}'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as ve:
            return Response(
                {'error': str(ve)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build or load graph
        graph = build_dependency_graph(repo.id, repo_dir, force_rebuild=force_rebuild)

        if normalized_rel_path not in graph.all_files:
            return Response(
                {'error': f"File '{normalized_rel_path}' is not a supported source code file in this repository."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calculate impact
        impact_result = analyze_file_impact(graph, normalized_rel_path)

        # Optional Gemini advisory
        ai_advisory = generate_ai_advisory(impact_result)
        impact_result['ai_advisory'] = ai_advisory

        return Response(impact_result, status=status.HTTP_200_OK)
