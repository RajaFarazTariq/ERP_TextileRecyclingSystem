# users/views.py
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status, generics, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditLog, log_action
from apps.core.permissions import IsUsersOrAdmin
from .models import CustomUser
from .serializers import RegisterSerializer, UserSerializer


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


def _log_failed_login(request, identifier, user=None):
    """Record a failed login. `user` is set when the account exists."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    AuditLog.objects.create(
        user=user,
        username=identifier[:150],
        action=AuditLog.ACTION_LOGIN_FAILED,
        model_name='CustomUser',
        object_id=str(user.pk) if user else '',
        object_repr=f'Failed login for "{identifier[:200]}"',
        ip_address=x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR'),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        endpoint=request.path[:300],
    )


def _password_errors(password, user=None):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        return list(exc.messages)
    return []


class LoginView(APIView):
    """
    Login with username OR email.
    POST { "username": "erp_admin" or "user@gmail.com", "password": "..." }

    Rate limited per client IP (see REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login']).
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        request=inline_serializer('LoginRequest', {
            'username': serializers.CharField(help_text='Username or email'),
            'password': serializers.CharField(),
        }),
        responses=OpenApiTypes.OBJECT,
    )
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
            _log_failed_login(request, identifier, user)
            return Response(
                {'non_field_errors': ['Invalid username/email or password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            _log_failed_login(request, identifier, user)
            return Response(
                {'non_field_errors': ['This account is inactive. Contact your administrator.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Record last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        log_action(user, AuditLog.ACTION_LOGIN, user, request=request)

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


class LogoutView(APIView):
    """
    Revoke a refresh token. POST { "refresh": "..." }
    Holding the refresh token is the proof needed, so this works even after the
    access token has expired.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=inline_serializer('LogoutRequest', {'refresh': serializers.CharField()}),
        responses={205: None},
    )
    def post(self, request):
        try:
            RefreshToken(request.data.get('refresh', '')).blacklist()
        except TokenError:
            pass   # already invalid or expired: nothing left to revoke
        return Response(status=status.HTTP_205_RESET_CONTENT)


class RegisterView(APIView):
    """Create a new user — admin only."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=RegisterSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        # Only admin can register new users
        if getattr(request.user, 'role', None) != 'admin':
            return Response(
                {'error': 'Only admins can create users.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            errors = _password_errors(serializer.validated_data['password'])
            if errors:
                return Response({'password': errors}, status=status.HTTP_400_BAD_REQUEST)
            user = serializer.save()
            log_action(request.user, AuditLog.ACTION_CREATE, user, request=request)
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
        # A blank password means "keep the current one"
        password = data.pop('password', None)
        if isinstance(password, list):   # QueryDict.pop returns a list
            password = password[0] if password else None

        serializer = self.get_serializer(instance, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if password:
            errors = _password_errors(password, user=instance)
            if errors:
                return Response({'password': errors}, status=status.HTTP_400_BAD_REQUEST)

        before = {f: getattr(instance, f) for f in ('username', 'email', 'role', 'is_active')}
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])

        changes = {
            f: {'old': old, 'new': getattr(user, f)}
            for f, old in before.items() if getattr(user, f) != old
        }
        if password:
            changes['password'] = {'old': '***', 'new': '***'}   # never log the value
        log_action(request.user, AuditLog.ACTION_UPDATE, user, changes=changes, request=request)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        with transaction.atomic():   # a blocked delete rolls the log entry back
            log_action(self.request.user, AuditLog.ACTION_DELETE, instance, request=self.request)
            instance.delete()


class ToggleActiveView(APIView):
    """Toggle a user's is_active status — admin only."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
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
        log_action(request.user, AuditLog.ACTION_UPDATE, user, request=request,
                   changes={'is_active': {'old': not user.is_active, 'new': user.is_active}})
        return Response({
            'message':   f"User {'activated' if user.is_active else 'deactivated'} successfully.",
            'is_active': user.is_active,
            'username':  user.username,
        })
