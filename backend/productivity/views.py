"""
Productivity REST Views (Phase 6 — Productivity Intelligence).

Enforces strict user authentication, repository ownership validation,
query parameter validation, intelligent persistent caching, and pagination.
"""

import logging
import math
from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from memory.models import CommitMemory
from repositories.models import Repository
from productivity.models import ProductivityCache
from productivity.serializers import ProductivityQueryParamSerializer
from productivity.services.analytics import calculate_productivity_analytics
from productivity.services.ai_insights import generate_productivity_insights

logger = logging.getLogger(__name__)


def _get_user_repository(pk: int, user) -> Optional[Repository]:
    """Retrieve repository belonging to the requesting user."""
    try:
        return Repository.objects.get(pk=pk, user=user)
    except Repository.DoesNotExist:
        return None


def _get_or_compute_analytics(
    repository: Repository,
    time_range: str = '30d',
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    aggregation: str = 'daily',
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Retrieve cached productivity analytics or calculate them fresh.
    Invalidates automatically if commit count in CommitMemory has changed.
    """
    total_commits = CommitMemory.objects.filter(repository=repository).count()
    if total_commits == 0 and not force_refresh:
        try:
            from memory.services import index_commit_history
            new_c = index_commit_history(repository, incremental=True)
            if new_c > 0:
                total_commits = CommitMemory.objects.filter(repository=repository).count()
        except Exception as exc:
            logger.warning("Auto-sync commit history for repo %d: %s", repository.id, exc)

    latest_commit = CommitMemory.objects.filter(repository=repository).order_by('-committed_date').first()
    latest_commit_dt = latest_commit.committed_date if latest_commit else None

    # Check cache if not forced and not custom range
    if not force_refresh and time_range != 'custom':
        cached = ProductivityCache.objects.filter(
            repository=repository,
            time_range=time_range,
            aggregation=aggregation,
        ).first()

        if cached and cached.calculated_metrics:
            if cached.commits_count_at_generation == total_commits:
                return cached.calculated_metrics

    # Compute fresh
    analytics = calculate_productivity_analytics(
        repository=repository,
        time_range=time_range,
        start_date_str=start_date,
        end_date_str=end_date,
        aggregation=aggregation,
    )

    # Persist cache
    if time_range != 'custom':
        ProductivityCache.objects.update_or_create(
            repository=repository,
            time_range=time_range,
            aggregation=aggregation,
            defaults={
                'calculated_metrics': analytics,
                'commits_count_at_generation': total_commits,
                'latest_commit_date_at_generation': latest_commit_dt,
            },
        )

    return analytics


def _paginate_list(items: list, page: int, page_size: int) -> Dict[str, Any]:
    """Slice list and return pagination envelope."""
    total_count = len(items)
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    sliced_items = items[start_idx:end_idx]

    return {
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'has_next': page < total_pages,
        'has_previous': page > 1,
        'results': sliced_items,
    }


# ─── 1. Productivity Overview ────────────────────────────────────────────────

class ProductivityOverviewView(APIView):
    """
    GET /api/repositories/<pk>/productivity/
    High-level productivity metrics, activity summary, date boundaries,
    and previous period delta comparison.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        # Overview response omitting heavy full file/timeline arrays
        return Response({
            'repository_id': analytics['repository_id'],
            'repository_name': analytics['repository_name'],
            'repository_owner': analytics['repository_owner'],
            'time_range': analytics['time_range'],
            'start_date': analytics['start_date'],
            'end_date': analytics['end_date'],
            'aggregation': analytics['aggregation'],
            'timestamp_basis': analytics['timestamp_basis'],
            'overview': analytics['overview'],
            'knowledge_distribution': analytics['knowledge_distribution'],
            'data_availability': analytics['data_availability'],
        })


# ─── 2. Activity Timeline ─────────────────────────────────────────────────────

class ProductivityActivityView(APIView):
    """
    GET /api/repositories/<pk>/productivity/activity/
    Returns continuous chart-ready time-series data grouped by day, week, or month.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        return Response({
            'repository_id': analytics['repository_id'],
            'time_range': analytics['time_range'],
            'aggregation': analytics['aggregation'],
            'timestamp_basis': analytics['timestamp_basis'],
            'overview': analytics['overview'],
            'timeline': analytics['timeline'],
        })


# ─── 3. Contributor Insights ──────────────────────────────────────────────────

class ProductivityContributorsView(APIView):
    """
    GET /api/repositories/<pk>/productivity/contributors/
    Returns contributor activity summaries, modified file counts, and top modules.
    Supports filtering and pagination.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        contributors = analytics['contributors']

        # Search filter
        search = (params.get('search') or '').strip().lower()
        if search:
            contributors = [
                c for c in contributors
                if search in c['display_name'].lower() or search in c['email'].lower()
            ]

        # Sorting
        ordering = params.get('ordering', '-commits')
        reverse = ordering.startswith('-')
        sort_field = ordering.lstrip('-')
        if sort_field == 'commits':
            contributors.sort(key=lambda x: x['commit_count'], reverse=reverse)
        elif sort_field == 'churn':
            contributors.sort(key=lambda x: x['total_churn'], reverse=reverse)
        elif sort_field == 'recent':
            contributors.sort(key=lambda x: x['last_commit'] or '', reverse=reverse)

        paginated = _paginate_list(contributors, params['page'], params['page_size'])
        paginated['time_range'] = analytics['time_range']
        paginated['knowledge_distribution'] = analytics['knowledge_distribution']
        return Response(paginated)


# ─── 4. File Hotspots ─────────────────────────────────────────────────────────

class ProductivityHotspotsView(APIView):
    """
    GET /api/repositories/<pk>/productivity/hotspots/
    Returns file modification hotspots, commit touches, and code churn.
    Supports single-file deep dive via ?file_path=...
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        target_file = (params.get('file_path') or '').strip()

        # Detailed single-file activity view
        if target_file:
            return self._get_file_detail(repo, target_file, params)

        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        hotspots = analytics['hotspots']

        # Search filter
        search = (params.get('search') or '').strip().lower()
        if search:
            hotspots = [
                h for h in hotspots
                if search in h['file_path'].lower() or search in h['module'].lower()
            ]

        # Sorting
        ordering = params.get('ordering', '-commits')
        reverse = ordering.startswith('-')
        sort_field = ordering.lstrip('-')
        if sort_field == 'commits':
            hotspots.sort(key=lambda x: x['commit_count'], reverse=reverse)
        elif sort_field == 'churn':
            hotspots.sort(key=lambda x: x['total_churn'], reverse=reverse)
        elif sort_field == 'recent':
            hotspots.sort(key=lambda x: x['last_modified'] or '', reverse=reverse)
        elif sort_field == 'contributors':
            hotspots.sort(key=lambda x: x['contributor_count'], reverse=reverse)

        paginated = _paginate_list(hotspots, params['page'], params['page_size'])
        paginated['time_range'] = analytics['time_range']
        return Response(paginated)

    def _get_file_detail(self, repository: Repository, file_path: str, params: dict) -> Response:
        """Inspect all commits that modified a specific file."""
        commits = CommitMemory.objects.filter(repository=repository).order_by('-committed_date')
        file_commits = []
        total_adds = 0
        total_dels = 0
        authors_set = set()

        for c in commits:
            files_changed = c.files_changed or []
            match = next((f for f in files_changed if f.get('filename') == file_path), None)
            if match:
                adds = match.get('additions', 0)
                dels = match.get('deletions', 0)
                total_adds += adds
                total_dels += dels
                authors_set.add(c.author_name or 'Unknown')

                file_commits.append({
                    'commit_sha': c.commit_sha,
                    'author_name': c.author_name,
                    'committed_date': c.committed_date.isoformat(),
                    'message': c.message.split('\n')[0][:80],
                    'status': match.get('status', 'modified'),
                    'additions': adds,
                    'deletions': dels,
                    'churn': adds + dels,
                })

        return Response({
            'file_path': file_path,
            'repository_id': repository.id,
            'commit_touches_count': len(file_commits),
            'contributors_count': len(authors_set),
            'contributors': sorted(list(authors_set)),
            'total_additions': total_adds,
            'total_deletions': total_dels,
            'net_line_change': total_adds - total_dels,
            'total_churn': total_adds + total_dels,
            'impact_analysis_url': f"/repository/{repository.id}/impact?file={file_path}",
            'commits': file_commits,
        })


# ─── 5. Module Analytics ──────────────────────────────────────────────────────

class ProductivityModulesView(APIView):
    """
    GET /api/repositories/<pk>/productivity/modules/
    Directory-level activity aggregation, file distributions, and
    single-contributor indicators.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        return Response({
            'repository_id': analytics['repository_id'],
            'time_range': analytics['time_range'],
            'modules_count': len(analytics['modules']),
            'modules': analytics['modules'],
        })


# ─── 6. Code Churn Analysis ───────────────────────────────────────────────────

class ProductivityChurnView(APIView):
    """
    GET /api/repositories/<pk>/productivity/churn/
    Separates net change from total change volume, provides additions vs deletions
    breakdown over time and top churn files.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=params['range'],
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=params['aggregation'],
        )

        return Response({
            'repository_id': analytics['repository_id'],
            'time_range': analytics['time_range'],
            'aggregation': analytics['aggregation'],
            'churn': analytics['churn'],
            'churn_timeline': [
                {
                    'bucket': t['bucket'],
                    'additions': t['additions'],
                    'deletions': t['deletions'],
                    'net_change': t['net_change'],
                    'total_churn': t['total_churn'],
                }
                for t in analytics['timeline']
            ],
        })


# ─── 7. Grounded AI Insights ──────────────────────────────────────────────────

class ProductivityInsightsView(APIView):
    """
    GET /api/repositories/<pk>/productivity/insights/
    POST /api/repositories/<pk>/productivity/insights/
    Returns grounded Gemini AI insights based on calculated analytics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return self._handle_insights(request, pk, force_regenerate=False)

    def post(self, request, pk):
        force = bool(request.data.get('force_regenerate', True))
        return self._handle_insights(request, pk, force_regenerate=force)

    def _handle_insights(self, request, pk: int, force_regenerate: bool = False) -> Response:
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        param_serializer = ProductivityQueryParamSerializer(data=request.query_params)
        if not param_serializer.is_valid():
            return Response(param_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = param_serializer.validated_data
        time_range = params['range']
        aggregation = params['aggregation']

        # Check existing cached insights
        cache_entry = ProductivityCache.objects.filter(
            repository=repo,
            time_range=time_range,
            aggregation=aggregation,
        ).first()

        total_commits = CommitMemory.objects.filter(repository=repo).count()

        if (
            not force_regenerate
            and cache_entry
            and cache_entry.ai_insights
            and cache_entry.commits_count_at_generation == total_commits
        ):
            return Response(cache_entry.ai_insights)

        # Generate fresh insights
        analytics = _get_or_compute_analytics(
            repository=repo,
            time_range=time_range,
            start_date=params.get('start_date'),
            end_date=params.get('end_date'),
            aggregation=aggregation,
        )

        insights = generate_productivity_insights(analytics)

        if cache_entry:
            cache_entry.ai_insights = insights
            cache_entry.save(update_fields=['ai_insights', 'updated_at'])

        return Response(insights)


# ─── 8. Refresh Analytics ─────────────────────────────────────────────────────

class ProductivityRefreshView(APIView):
    """
    POST /api/repositories/<pk>/productivity/refresh/
    Clears cached productivity records and incrementally pulls latest commits
    using memory.services.index_commit_history.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        repo = _get_user_repository(pk, request.user)
        if not repo:
            return Response({'error': 'Repository not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Clear cached analytics for this repository
        deleted_count, _ = ProductivityCache.objects.filter(repository=repo).delete()
        logger.info("Cleared %d cached productivity snapshots for repo %d", deleted_count, repo.id)

        # 2. Re-trigger incremental commit ingestion
        new_commits = 0
        try:
            from memory.services import index_commit_history
            new_commits = index_commit_history(repo, incremental=True)
            logger.info("Ingested %d new commits for repo %d during productivity refresh", new_commits, repo.id)
        except Exception as exc:
            logger.warning("Commit history sync during refresh encountered issue: %s (non-fatal)", exc)

        total_commits = CommitMemory.objects.filter(repository=repo).count()

        return Response({
            'message': 'Productivity analytics cache refreshed successfully.',
            'repository_id': repo.id,
            'new_commits_ingested': new_commits,
            'total_commits_in_memory': total_commits,
        })
