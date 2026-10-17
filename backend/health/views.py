"""
Views for Phase 5 Repository Health Dashboard.

Enforces:
1. Strict user repository ownership (IsAuthenticated + User FK check)
2. Scoped database queries by repository
3. Path traversal security
4. Pagination, filtering, and sorting
5. Grounded AI summary generation with fallback
"""

import logging
from pathlib import Path
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from repositories.models import Repository
from .models import RepositoryHealthSnapshot, HealthFinding
from .serializers import (
    RepositoryHealthSnapshotSerializer,
    HealthFindingSerializer,
    HealthTrendsSnapshotSerializer,
)
from .services.scanner import run_health_scan
from .services.ai_summary import generate_ai_health_summary

logger = logging.getLogger(__name__)


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
        return repo, None, "Repository source files are not available locally. Please re-analyse repository first."

    return repo, repo_dir, None


class HealthFindingsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class RepositoryHealthOverviewView(APIView):
    """
    GET /api/repositories/<pk>/health/
    Returns the latest health snapshot, summary scores, and scan status.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        latest = RepositoryHealthSnapshot.objects.filter(repository=repo).order_by('-created_at').first()
        if not latest:
            return Response({
                'repository_id': repo.id,
                'repository_name': repo.name,
                'has_snapshot': False,
                'message': 'No health scan has been performed yet for this repository.',
            }, status=status.HTTP_200_OK)

        serializer = RepositoryHealthSnapshotSerializer(latest)
        return Response({
            'repository_id': repo.id,
            'repository_name': repo.name,
            'has_snapshot': True,
            'latest_snapshot': serializer.data,
        }, status=status.HTTP_200_OK)


class RepositoryHealthScanView(APIView):
    """
    POST /api/repositories/<pk>/health/scan/
    Body: { "force_rescan": false, "generate_ai_summary": true }
    Runs or reuses a deterministic health scan and optionally generates an AI health summary.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        force_rescan = bool(request.data.get('force_rescan', False))
        want_ai = bool(request.data.get('generate_ai_summary', True))

        try:
            snapshot, delta_info = run_health_scan(repo, repo_dir, force_rescan=force_rescan)
        except Exception as e:
            logger.exception("Health scan failed: %s", e)
            return Response(
                {'error': f"Failed to complete health scan: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Optional AI summary generation
        if want_ai and (not snapshot.ai_summary_available or force_rescan):
            findings_data = list(
                HealthFinding.objects.filter(snapshot=snapshot)
                .values('severity', 'category', 'title', 'file_path', 'symbol_name', 'evidence', 'estimated_effort')
            )
            ai_res = generate_ai_health_summary(
                overall_score=snapshot.overall_score,
                grade=snapshot.grade,
                component_scores=snapshot.component_scores,
                metrics_summary=snapshot.metrics_summary,
                findings=findings_data,
            )
            snapshot.ai_summary = ai_res.get('executive_summary', '')
            snapshot.ai_recommended_actions = ai_res.get('recommended_actions', [])
            snapshot.ai_summary_available = True
            snapshot.save(update_fields=['ai_summary', 'ai_recommended_actions', 'ai_summary_available'])

        serializer = RepositoryHealthSnapshotSerializer(snapshot)
        return Response({
            'message': 'Health scan completed successfully.',
            'snapshot': serializer.data,
            'delta': delta_info,
        }, status=status.HTTP_201_CREATED if not delta_info.get('cached') else status.HTTP_200_OK)


class RepositoryHealthFindingsView(APIView):
    """
    GET /api/repositories/<pk>/health/findings/
    Query parameters:
    - severity: CRITICAL | HIGH | MEDIUM | LOW | INFO
    - category: COMPLEXITY | MAINTAINABILITY | DUPLICATION | TESTING | DOCUMENTATION | ARCHITECTURE
    - file_path: Substring match on file path
    - search: Search text in title or description
    - ordering: Field to order by (default: severity hierarchy)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        latest_snapshot = RepositoryHealthSnapshot.objects.filter(repository=repo).order_by('-created_at').first()
        if not latest_snapshot:
            return Response({'count': 0, 'results': []}, status=status.HTTP_200_OK)

        queryset = HealthFinding.objects.filter(snapshot=latest_snapshot)

        # Filters
        severity = request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity.upper())

        category = request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category.upper())

        file_path = request.query_params.get('file_path')
        if file_path:
            queryset = queryset.filter(file_path__icontains=file_path)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search) | queryset.filter(description__icontains=search)

        # Ordering
        ordering = request.query_params.get('ordering')
        if ordering:
            queryset = queryset.order_by(ordering)
        else:
            # Custom ordering: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
            queryset = queryset.order_by('severity', 'file_path')

        paginator = HealthFindingsPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = HealthFindingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class RepositoryHealthFilesView(APIView):
    """
    GET /api/repositories/<pk>/health/files/
    Query parameters:
    - search: search file path
    - ordering: -complexity | -line_count | -findings_count | file_path
    - has_issues_only: true | false
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        latest_snapshot = RepositoryHealthSnapshot.objects.filter(repository=repo).order_by('-created_at').first()
        if not latest_snapshot:
            return Response({'total_files': 0, 'files': []}, status=status.HTTP_200_OK)

        file_metrics = list(latest_snapshot.file_metrics or [])

        # Search filter
        search = request.query_params.get('search', '').strip().lower()
        if search:
            file_metrics = [f for f in file_metrics if search in f.get('file_path', '').lower()]

        # Has issues only
        has_issues_only = request.query_params.get('has_issues_only', '').lower() == 'true'
        if has_issues_only:
            file_metrics = [f for f in file_metrics if f.get('findings_count', 0) > 0]

        # Sorting
        ordering = request.query_params.get('ordering', '-findings_count')
        reverse = ordering.startswith('-')
        sort_key = ordering.lstrip('-')

        if sort_key in ('complexity', 'max_complexity'):
            file_metrics.sort(key=lambda x: x.get('max_complexity', 1), reverse=reverse)
        elif sort_key in ('line_count', 'lines'):
            file_metrics.sort(key=lambda x: x.get('line_count', 0), reverse=reverse)
        elif sort_key == 'findings_count':
            file_metrics.sort(key=lambda x: x.get('findings_count', 0), reverse=reverse)
        else:
            file_metrics.sort(key=lambda x: x.get('file_path', ''), reverse=reverse)

        return Response({
            'repository_id': repo.id,
            'total_files': len(file_metrics),
            'files': file_metrics,
        }, status=status.HTTP_200_OK)


class RepositoryHealthTrendsView(APIView):
    """
    GET /api/repositories/<pk>/health/trends/
    Returns chronological timeline of historical snapshots with score deltas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        snapshots = list(
            RepositoryHealthSnapshot.objects.filter(repository=repo)
            .order_by('created_at')
        )

        trend_items = []
        for idx, snap in enumerate(snapshots):
            delta = None
            if idx > 0:
                prev = snapshots[idx - 1]
                delta = {
                    'score_diff': round(snap.overall_score - prev.overall_score, 1),
                    'total_findings_diff': snap.findings_summary.get('total', 0) - prev.findings_summary.get('total', 0),
                }

            trend_items.append({
                'id': snap.id,
                'commit_sha': snap.commit_sha,
                'overall_score': snap.overall_score,
                'grade': snap.grade,
                'component_scores': snap.component_scores,
                'findings_summary': snap.findings_summary,
                'metrics_summary': snap.metrics_summary,
                'created_at': snap.created_at.isoformat(),
                'delta': delta,
            })

        return Response({
            'repository_id': repo.id,
            'total_snapshots': len(trend_items),
            'trends': trend_items,
        }, status=status.HTTP_200_OK)
