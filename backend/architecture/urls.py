from django.urls import path
from .views import (
    ArchitectureOverviewView,
    ArchitectureTreeView,
    ArchitectureGraphView,
    ArchitectureNodeDetailView,
    ArchitectureFindingsView,
)

urlpatterns = [
    path('', ArchitectureOverviewView.as_view(), name='architecture-overview'),
    path('tree/', ArchitectureTreeView.as_view(), name='architecture-tree'),
    path('graph/', ArchitectureGraphView.as_view(), name='architecture-graph'),
    path('node/', ArchitectureNodeDetailView.as_view(), name='architecture-node-detail'),
    path('findings/', ArchitectureFindingsView.as_view(), name='architecture-findings'),
]
