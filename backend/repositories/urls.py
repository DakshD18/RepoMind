from django.urls import path, include
from .views import AnalyseRepositoryView, RepositoryListView, RepositoryDetailView
from .chat_views import (
    IndexRepositoryView,
    ChatView,
    ChatSessionListView,
    ChatSessionDetailView,
)

urlpatterns = [
    # Phase 1 — Repository management
    path('analyse/', AnalyseRepositoryView.as_view(), name='analyse-repository'),
    path('', RepositoryListView.as_view(), name='repository-list'),
    path('<int:pk>/', RepositoryDetailView.as_view(), name='repository-detail'),

    # Phase 2 — AI Indexing & Chat
    path('<int:pk>/index/', IndexRepositoryView.as_view(), name='index-repository'),
    path('<int:pk>/chat/', ChatView.as_view(), name='repository-chat'),
    path('<int:pk>/sessions/', ChatSessionListView.as_view(), name='chat-session-list'),
    path('<int:pk>/sessions/<int:session_id>/', ChatSessionDetailView.as_view(), name='chat-session-detail'),

    # Phase 4 — Impact Analysis
    path('<int:pk>/impact/', include('impact.urls')),
]
