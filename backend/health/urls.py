"""
URL Routing for Health Dashboard API (Phase 5).
"""

from django.urls import path
from .views import (
    RepositoryHealthOverviewView,
    RepositoryHealthScanView,
    RepositoryHealthFindingsView,
    RepositoryHealthFilesView,
    RepositoryHealthTrendsView,
)

urlpatterns = [
    path('', RepositoryHealthOverviewView.as_view(), name='health-overview'),
    path('scan/', RepositoryHealthScanView.as_view(), name='health-scan'),
    path('findings/', RepositoryHealthFindingsView.as_view(), name='health-findings'),
    path('files/', RepositoryHealthFilesView.as_view(), name='health-files'),
    path('trends/', RepositoryHealthTrendsView.as_view(), name='health-trends'),
]
