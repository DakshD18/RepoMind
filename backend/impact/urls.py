from django.urls import path
from .views import ImpactFilesView, ImpactAnalysisView

urlpatterns = [
    path('files/', ImpactFilesView.as_view(), name='impact-files'),
    path('', ImpactAnalysisView.as_view(), name='impact-analysis'),
]
