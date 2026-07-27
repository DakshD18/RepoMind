import requests
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .serializers import UserSerializer


def get_tokens_for_user(user):
    """Generate JWT access and refresh tokens for a given user."""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class GoogleAuthView(APIView):
    """
    POST /api/auth/google
    Accepts a Google OAuth credential (ID token), verifies it,
    creates or fetches the user, and returns JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get('credential')

        if not credential:
            return Response(
                {'error': 'Google credential is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Verify the Google ID token
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError as e:
            return Response(
                {'error': f'Invalid Google token: {str(e)}'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        email = idinfo.get('email')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')

        if not email:
            return Response(
                {'error': 'Could not retrieve email from Google token.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create or retrieve the user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': first_name,
                'last_name': last_name,
            }
        )

        # Update name if user already existed
        if not created:
            user.first_name = first_name or user.first_name
            user.last_name = last_name or user.last_name
            user.save()

        tokens = get_tokens_for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)


class GitHubAuthView(APIView):
    """
    POST /api/auth/github
    Accepts a GitHub OAuth authorization code, exchanges it for an access token,
    fetches user details and email from GitHub API, creates/retrieves user, and returns JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get('code')

        if not code:
            return Response(
                {'error': 'GitHub authorization code is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 1: Exchange code for GitHub access token
        token_response = requests.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': settings.GITHUB_CLIENT_ID,
                'client_secret': settings.GITHUB_CLIENT_SECRET,
                'code': code,
            },
            headers={'Accept': 'application/json'}
        )

        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            error_desc = token_data.get('error_description', 'Failed to obtain access token from GitHub.')
            return Response(
                {'error': error_desc},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 2: Fetch user profile from GitHub
        user_response = requests.get(
            'https://api.github.com/user',
            headers={'Authorization': f'token {access_token}'}
        )

        if user_response.status_code != 200:
            return Response(
                {'error': 'Failed to fetch user profile from GitHub.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        github_user = user_response.json()
        email = github_user.get('email')
        github_username = github_user.get('login', '')
        name_parts = (github_user.get('name') or '').split(' ', 1)
        first_name = name_parts[0] if name_parts else github_username
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        # Step 3: Fetch verified primary email if profile email is private
        if not email:
            emails_response = requests.get(
                'https://api.github.com/user/emails',
                headers={'Authorization': f'token {access_token}'}
            )
            if emails_response.status_code == 200:
                emails = emails_response.json()
                primary_email = next((e['email'] for e in emails if e.get('primary') and e.get('verified')), None)
                email = primary_email or (emails[0]['email'] if emails else None)

        if not email:
            email = f"{github_username}@users.noreply.github.com"

        # Step 4: Create or retrieve User record
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': first_name,
                'last_name': last_name,
            }
        )

        if not created:
            user.first_name = first_name or user.first_name
            user.last_name = last_name or user.last_name
            user.save()

        tokens = get_tokens_for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)


class EmailLoginView(APIView):
    """
    POST /api/auth/login
    Accepts email and password, authenticates user, and returns JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        tokens = get_tokens_for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)


class EmailRegisterView(APIView):
    """
    POST /api/auth/register
    Registers a new user with email and password, and returns JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'User with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        tokens = get_tokens_for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    """
    GET /api/auth/me
    Returns the currently authenticated user's details.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
