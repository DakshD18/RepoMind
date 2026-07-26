from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from repositories.models import Repository
from repositories.serializers import RepositorySerializer


class DashboardRepositoryView(APIView):
    """
    GET /api/dashboard/:id
    Returns a full repository overview for the given repository ID,
    ensuring the repository belongs to the current user.
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
