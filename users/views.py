# users/views.py
from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db.models import Q

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer
from .models import CustomUser

try:
    from core.permissions import IsUsersOrAdmin
except ImportError:
    from rest_framework.permissions import IsAuthenticated as IsUsersOrAdmin

# Keep using DRF's IsAdminUser for write operations (register/update/delete/toggle)
from rest_framework.permissions import IsAuthenticated


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


class LoginView(APIView):
    """
    Login with username OR email.
    POST { "username": "erp_admin" or "user@gmail.com", "password": "..." }

    Accepts both username and email in the 'username' field —
    the frontend doesn't need to change, just the backend lookup does.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('username', '').strip()
        password   = request.data.get('password', '')

        if not identifier or not password:
            return Response(
                {'non_field_errors': ['Username/email and password are required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Look up by username OR email (case-insensitive)
        user = CustomUser.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()

        if user is None or not user.check_password(password):
            return Response(
                {'non_field_errors': ['Invalid username/email or password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            return Response(
                {'non_field_errors': ['This account is inactive. Contact your administrator.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Record last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        tokens = get_tokens_for_user(user)
        return Response({
            'token': tokens,
            'user': {
                'id':       user.id,
                'username': user.username,
                'email':    user.email,
                'role':     user.role,
            },
        }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """Create a new user — admin only."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Only admin can register new users
        if getattr(request.user, 'role', None) != 'admin':
            return Response(
                {'error': 'Only admins can create users.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'User created successfully.'},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListAPIView):
    """
    List all users.
    GET — any authenticated role (needed for dropdowns in all modules).
    """
    queryset = CustomUser.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsUsersOrAdmin]


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve / update / delete a single user.
    Admin only for writes.
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        # Allow GET for all authenticated users, restrict writes to admin
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if getattr(request.user, 'role', None) != 'admin':
                self.permission_denied(
                    request, message='Only admins can update or delete users.'
                )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy()
        # If password is blank, don't overwrite it
        if not data.get('password'):
            data.pop('password', None)
        serializer = self.get_serializer(instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ToggleActiveView(APIView):
    """Toggle a user's is_active status — admin only."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if getattr(request.user, 'role', None) != 'admin':
            return Response(
                {'error': 'Only admins can toggle user status.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = CustomUser.objects.get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response({
            'message':   f"User {'activated' if user.is_active else 'deactivated'} successfully.",
            'is_active': user.is_active,
            'username':  user.username,
        })