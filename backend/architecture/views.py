"""
Architecture Views for RepoMind.

Follows Django REST Framework conventions:
1. Strict user repository ownership (IsAuthenticated + User FK check).
2. Safe path validation to prevent directory traversal.
3. Clean, consistent JSON responses.
"""

from pathlib import Path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from impact.views import _get_user_repository
from impact.resolver import validate_safe_path, SecurityException
from impact.graph import build_dependency_graph
from .services import (
    get_architecture_overview,
    build_architecture_tree,
    extract_architecture_graph,
    extract_node_detail,
    detect_architecture_findings,
)


class ArchitectureOverviewView(APIView):
    """
    GET /api/repositories/<pk>/architecture/
    Returns high-level architecture overview metrics, languages, layers, and issue counts.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        overview = get_architecture_overview(repo, repo_dir)
        return Response(overview, status=status.HTTP_200_OK)


class ArchitectureTreeView(APIView):
    """
    GET /api/repositories/<pk>/architecture/tree/
    Returns the hierarchical directory and file tree explorer.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        search_query = request.query_params.get('search', '').strip()
        graph = build_dependency_graph(repo.id, repo_dir)
        tree = build_architecture_tree(repo_dir, graph, search_query=search_query)

        return Response({
            'repo_id': repo.id,
            'total_files': len(graph.all_files),
            'tree': tree,
        }, status=status.HTTP_200_OK)


class ArchitectureGraphView(APIView):
    """
    GET /api/repositories/<pk>/architecture/graph/
    Returns nodes and edges for interactive dependency graph visualization.
    Query params:
    - module: filter by directory prefix (e.g. 'backend/impact')
    - search: filter by file name or path
    - component_type: filter by type (service, component, model, route, config, test, file)
    - relationship_type: filter edges by type (imports_module, imports_symbol, calls_function)
    - focus: file_path to focus on and expand immediate neighbors
    - limit: maximum nodes to return (default 80, max 300, 0 for unlimited)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        module_filter = request.query_params.get('module')
        search_query = request.query_params.get('search')
        component_type = request.query_params.get('component_type')
        relationship_type = request.query_params.get('relationship_type')
        focus_file = request.query_params.get('focus')

        try:
            limit = int(request.query_params.get('limit', 80))
            if limit < 0:
                limit = 80
            elif limit > 300:
                limit = 300
        except ValueError:
            limit = 80

        # Validate focus file safety if provided
        if focus_file:
            try:
                validate_safe_path(repo_dir, focus_file)
            except SecurityException as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except FileNotFoundError:
                return Response({'error': f"Focus file '{focus_file}' not found."}, status=status.HTTP_404_NOT_FOUND)

        graph_data = extract_architecture_graph(
            repo=repo,
            repo_dir=repo_dir,
            module_filter=module_filter,
            search_query=search_query,
            component_type_filter=component_type,
            relationship_type_filter=relationship_type,
            focus_file=focus_file,
            limit=limit,
        )

        return Response(graph_data, status=status.HTTP_200_OK)


class ArchitectureNodeDetailView(APIView):
    """
    GET /api/repositories/<pk>/architecture/node/?path=<file_path>
    Returns detailed incoming/outgoing dependencies, defined symbols, issues, and metadata.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        file_path = request.query_params.get('path', '').strip()
        if not file_path:
            return Response({'error': "Query parameter 'path' is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Path traversal security check
        try:
            validate_safe_path(repo_dir, file_path)
        except SecurityException as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except FileNotFoundError:
            return Response({'error': f"Component '{file_path}' was not found in repository."}, status=status.HTTP_404_NOT_FOUND)

        detail = extract_node_detail(repo, repo_dir, file_path)
        if detail is None:
            return Response({'error': f"Component '{file_path}' was not found in repository dependency graph."}, status=status.HTTP_404_NOT_FOUND)

        return Response(detail, status=status.HTTP_200_OK)


class ArchitectureFindingsView(APIView):
    """
    GET /api/repositories/<pk>/architecture/findings/
    Returns deterministic structural architecture issues (circular dependencies, unresolved imports).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        repo, repo_dir, err = _get_user_repository(pk, request.user)
        if repo is None:
            return Response({'error': err}, status=status.HTTP_404_NOT_FOUND)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        findings = detect_architecture_findings(repo, repo_dir)
        return Response(findings, status=status.HTTP_200_OK)
