from django.urls import path
from .views import AnalyseRepositoryView, RepositoryListView, RepositoryDetailView

urlpatterns = [
    path('analyse/', AnalyseRepositoryView.as_view(), name='analyse-repository'),
    path('', RepositoryListView.as_view(), name='repository-list'),
    path('<int:pk>/', RepositoryDetailView.as_view(), name='repository-detail'),
]
