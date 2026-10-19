"""
Productivity URL routing (Phase 6 — Productivity Intelligence).
"""

from django.urls import path
from productivity.views import (
    ProductivityOverviewView,
    ProductivityActivityView,
    ProductivityContributorsView,
    ProductivityHotspotsView,
    ProductivityModulesView,
    ProductivityChurnView,
    ProductivityInsightsView,
    ProductivityRefreshView,
)

urlpatterns = [
    # 1. Overview
    path('', ProductivityOverviewView.as_view(), name='productivity-overview'),

    # 2. Activity Timeline
    path('activity/', ProductivityActivityView.as_view(), name='productivity-activity'),

    # 3. Contributor Insights
    path('contributors/', ProductivityContributorsView.as_view(), name='productivity-contributors'),

    # 4. File Hotspots
    path('hotspots/', ProductivityHotspotsView.as_view(), name='productivity-hotspots'),

    # 5. Module Analytics
    path('modules/', ProductivityModulesView.as_view(), name='productivity-modules'),

    # 6. Code Churn
    path('churn/', ProductivityChurnView.as_view(), name='productivity-churn'),

    # 7. AI Insights
    path('insights/', ProductivityInsightsView.as_view(), name='productivity-insights'),

    # 8. Refresh & Sync
    path('refresh/', ProductivityRefreshView.as_view(), name='productivity-refresh'),
]
