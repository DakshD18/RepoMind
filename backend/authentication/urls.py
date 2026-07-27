from django.urls import path
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
    path('me/', CurrentUserView.as_view(), name='current-user'),
]
