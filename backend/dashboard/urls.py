from django.urls import path
from .views import DashboardRepositoryView

urlpatterns = [
    path('<int:pk>/', DashboardRepositoryView.as_view(), name='dashboard-repository'),
]
