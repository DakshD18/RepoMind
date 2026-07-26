from django.urls import path
from .views import GoogleAuthView, CurrentUserView

urlpatterns = [
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]
