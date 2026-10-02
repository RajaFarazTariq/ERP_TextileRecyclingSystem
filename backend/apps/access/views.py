from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog, log_action
from apps.core.permissions import is_admin
from apps.users.models import CustomUser
from . import services
from .models import RolePage, UserPageOverride


class IsAccessManager(permissions.BasePermission):
    """Access is managed by admins only: anyone else could give themselves everything."""
    message = 'Only an admin can manage access.'

    def has_permission(self, request, view):
        return is_admin(request.user)


MANAGER = [IsAuthenticated, IsAccessManager]


class MyAccessView(APIView):
    """The pages the caller may open (the web app asks this to build its menu and guard its routes)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        user = request.user
        return Response({'id': user.pk, 'username': user.username, 'email': user.email, 'role': user.role,
                         'pages': sorted(services.pages_for(user), key=services.PAGE_KEYS.index)})


class AccessMatrixView(APIView):
    """GET: the pages, the roles and which role has which page. PUT {roles: {role: [pages]}}: change it."""
    permission_classes = MANAGER

    def _state(self):
        overrides = (UserPageOverride.objects.exclude(user__role=services.ADMIN)
                     .values_list('user_id', flat=True).distinct().count())
        return {
            'pages': services.catalogue(),
            'roles': [{'key': role, 'label': services.ROLE_LABELS[role], 'locked': role == services.ADMIN}
                      for role in services.ROLES],
            'matrix': services.matrix(),
            'defaults': {role: sorted(pages, key=services.PAGE_KEYS.index)
                         for role, pages in services.DEFAULT_ROLE_PAGES.items()},
            'users_with_exceptions': overrides,
        }

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(self._state())

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request):
        roles = request.data.get('roles')
        if not isinstance(roles, dict):
            raise ValidationError({'roles': ['Send the pages of each role.']})
        cleaned = {}
        for role, pages in roles.items():
            if role == services.ADMIN:
                continue                     # admins always have everything; nothing to store
            if role not in services.SUPERVISORS:
                raise ValidationError({'roles': [f'Unknown role: {role}.']})
            if not isinstance(pages, list):
                raise ValidationError({'roles': [f'Give the pages of {role} as a list.']})
            unknown = sorted(set(pages) - set(services.PAGE_KEYS))
            if unknown:
                raise ValidationError({'roles': [f"Unknown page: {', '.join(unknown)}."]})
            locked = sorted(set(pages) & services.ADMIN_ONLY_PAGES)
            if locked:
                raise ValidationError({'roles': [f"{', '.join(locked).title()} is for admins only."]})
            cleaned[role] = pages
        with transaction.atomic():
            for role, pages in cleaned.items():
                added, removed = services.set_role_pages(role, pages)
                if added or removed:
                    log_action(request.user, AuditLog.ACTION_UPDATE, RolePage(role=role), request=request,
                               changes={'added': added, 'removed': removed},
                               extra_repr=f'Page access of {services.ROLE_LABELS[role]}')
        return Response(self._state())


class UserAccessView(APIView):
    """GET: one user's role pages, exceptions and result. PUT {overrides: {page: true|false}}: set the exceptions."""
    permission_classes = MANAGER

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk):
        return Response(services.user_access(get_object_or_404(CustomUser, pk=pk)))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        overrides = request.data.get('overrides')
        if not isinstance(overrides, dict):
            raise ValidationError({'overrides': ['Send the exceptions as {page: true or false}.']})
        if is_admin(user):
            if overrides:
                raise ValidationError({'overrides': ['An admin always has every page. Change the role to limit this user.']})
        for page, allowed in overrides.items():
            if page not in services.PAGE_KEYS:
                raise ValidationError({'overrides': [f'Unknown page: {page}.']})
            if page in services.ADMIN_ONLY_PAGES:
                raise ValidationError({'overrides': [f'{page.title()} is for admins only.']})
            if not isinstance(allowed, bool):
                raise ValidationError({'overrides': ['Each exception is true (give) or false (take away).']})
        role_has = services.role_pages(user.role)
        # An exception that says what the role already says is no exception: don't keep it
        overrides = {page: allowed for page, allowed in overrides.items() if allowed != (page in role_has)}
        with transaction.atomic():
            changes = services.set_user_overrides(user, overrides)
            if changes:
                log_action(request.user, AuditLog.ACTION_UPDATE, user, request=request,
                           changes={f'page:{page}': change for page, change in changes.items()})
        return Response(services.user_access(user))
