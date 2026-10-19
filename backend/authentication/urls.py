from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    GoogleAuthView,
    GitHubAuthView,
    EmailLoginView,
    EmailRegisterView,
    CurrentUserView,
)

urlpatterns = [
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('github/', GitHubAuthView.as_view(), name='github-auth'),
    path('login/', EmailLoginView.as_view(), name='email-login'),
    path('register/', EmailRegisterView.as_view(), name='email-register'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]
