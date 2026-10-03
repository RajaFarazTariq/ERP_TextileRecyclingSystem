from django.db import transaction
from django.utils.text import slugify
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
from .models import Role, RoleDuty, RolePage, UserPageOverride


class IsAccessManager(permissions.BasePermission):
    """Access is managed by admins only: anyone else could give themselves everything."""
    message = 'Only an admin can manage access.'

    def has_permission(self, request, view):
        return is_admin(request.user)


MANAGER = [IsAuthenticated, IsAccessManager]


class MyAccessView(APIView):
    """The pages the caller may open and at what level (the web app builds its menu and guards its routes with this)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        user = request.user
        levels = services._ordered(services.levels_for(user))
        return Response({'id': user.pk, 'username': user.username, 'email': user.email, 'role': user.role,
                         'role_label': services.role_label(user.role),
                         'duties': sorted(services.duties_for(user)),
                         'pages': list(levels), 'levels': levels})


class RoleNamesView(APIView):
    """What each role is called, for any signed-in user: screens show a role by its name."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([{'key': key, 'name': name} for key, name in services.roles()])


def _clean_levels(levels, allow_none):
    """Check {page: level} sent by an admin; returns it without unknown or locked pages being accepted."""
    if not isinstance(levels, dict):
        raise ValidationError('Send the pages as {page: level}.')
    allowed = services.LEVELS + ((services.NONE,) if allow_none else ())
    for page, level in levels.items():
        if page not in services.PAGE_KEYS:
            raise ValidationError(f'Unknown page: {page}.')
        if page in services.ADMIN_ONLY_PAGES:
            raise ValidationError(f'{page.title()} is for admins only.')
        if level not in allowed:
            raise ValidationError(f"The level of a page is one of: {', '.join(allowed)}.")
    return levels


def _roles():
    """Every role for the grids: the admin role is shown but can't be changed."""
    system = set(Role.objects.filter(is_system=True).values_list('key', flat=True))
    return [{'key': key, 'label': name, 'locked': key == services.ADMIN, 'is_system': key in system}
            for key, name in services.roles()]


class AccessMatrixView(APIView):
    """GET: the pages, the roles and each role's level per page. PUT {roles: {role: {page: level}}}: change it."""
    permission_classes = MANAGER

    def _state(self):
        overrides = (UserPageOverride.objects.exclude(user__role=services.ADMIN)
                     .values_list('user_id', flat=True).distinct().count())
        return {
            'pages': services.catalogue(),
            'roles': _roles(),
            'matrix': services.matrix(),
            'defaults': services.default_matrix(),
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
        for role, levels in roles.items():
            if role == services.ADMIN:
                continue                     # admins always have everything; nothing to store
            if role not in services.role_keys():
                raise ValidationError({'roles': [f'Unknown role: {role}.']})
            try:
                cleaned[role] = _clean_levels(levels, allow_none=False)
            except ValidationError as error:
                raise ValidationError({'roles': error.detail})
        with transaction.atomic():
            for role, levels in cleaned.items():
                changes = services.set_role_levels(role, levels)
                if changes:
                    log_action(request.user, AuditLog.ACTION_UPDATE, RolePage(role=role), request=request,
                               changes=changes, extra_repr=f'Page access of {services.role_label(role)}')
        return Response(self._state())


class UserAccessView(APIView):
    """GET: one user's role levels, exceptions and result. PUT {overrides: {page: 'none'|'view'|'full'}}: set the exceptions."""
    permission_classes = MANAGER

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, pk):
        return Response(services.user_access(get_object_or_404(CustomUser, pk=pk)))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        overrides = request.data.get('overrides')
        if is_admin(user) and overrides:
            raise ValidationError({'overrides': ['An admin always has every page. Change the role to limit this user.']})
        try:
            overrides = _clean_levels(overrides, allow_none=True)
        except ValidationError as error:
            raise ValidationError({'overrides': error.detail})
        role_has = services.role_levels(user.role)
        # An exception that says what the role already says is no exception: don't keep it
        overrides = {page: level for page, level in overrides.items() if level != role_has.get(page, services.NONE)}
        with transaction.atomic():
            changes = services.set_user_overrides(user, overrides)
            if changes:
                log_action(request.user, AuditLog.ACTION_UPDATE, user, request=request,
                           changes={f'page:{page}': change for page, change in changes.items()})
        return Response(services.user_access(user))


class DutyMatrixView(APIView):
    """GET: the duties, the roles and which role carries which duty. PUT {roles: {role: [duties]}}: change it."""
    permission_classes = MANAGER

    def _state(self):
        return {'duties': services.duty_catalogue(), 'roles': _roles(), 'matrix': services.duty_matrix(),
                'defaults': {role: [d for d in services.DUTY_KEYS if d in duties]
                             for role, duties in services.DEFAULT_ROLE_DUTIES.items()}}

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(self._state())

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request):
        roles = request.data.get('roles')
        if not isinstance(roles, dict):
            raise ValidationError({'roles': ['Send the duties of each role.']})
        cleaned = {}
        for role, duties in roles.items():
            if role == services.ADMIN:
                continue                     # admins always carry every duty
            if role not in services.role_keys():
                raise ValidationError({'roles': [f'Unknown role: {role}.']})
            if not isinstance(duties, list):
                raise ValidationError({'roles': [f'Give the duties of {role} as a list.']})
            unknown = sorted(set(duties) - set(services.DUTY_KEYS))
            if unknown:
                raise ValidationError({'roles': [f"Unknown duty: {', '.join(unknown)}."]})
            cleaned[role] = duties
        with transaction.atomic():
            for role, duties in cleaned.items():
                added, removed = services.set_role_duties(role, duties)
                if added or removed:
                    log_action(request.user, AuditLog.ACTION_UPDATE, RoleDuty(role=role), request=request,
                               changes={'added': added, 'removed': removed},
                               extra_repr=f'Duties of {services.role_label(role)}')
        return Response(self._state())


def _role_row(role, counts):
    return {'id': role.pk, 'key': role.key, 'name': role.name, 'description': role.description,
            'is_system': role.is_system, 'users': counts.get(role.key, 0)}


def _user_counts():
    from django.db.models import Count
    return dict(CustomUser.objects.values_list('role').annotate(n=Count('id')))


class RoleListView(APIView):
    """GET: every role with how many users have it. POST {name, description, copy_from}: add a role."""
    permission_classes = MANAGER

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        counts = _user_counts()
        return Response([_role_row(role, counts) for role in Role.objects.all()])

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        name = ' '.join(str(request.data.get('name') or '').split())
        if not name:
            raise ValidationError({'name': ['Enter a name for the role.']})
        if len(name) > 80:
            raise ValidationError({'name': ['Use at most 80 characters.']})
        key = slugify(name).replace('-', '_')[:50]
        if not key:
            raise ValidationError({'name': ['Use letters or numbers in the name.']})
        if Role.objects.filter(name__iexact=name).exists() or Role.objects.filter(key=key).exists():
            raise ValidationError({'name': ['There is already a role with this name.']})
        copy_from = request.data.get('copy_from') or ''
        if copy_from and (copy_from == services.ADMIN or copy_from not in services.role_keys()):
            raise ValidationError({'copy_from': ['Choose a role to copy, other than Admin.']})
        with transaction.atomic():
            role = Role.objects.create(key=key, name=name, description=str(request.data.get('description') or '')[:255])
            services.forget_roles()
            if copy_from:
                # The new role starts with the same pages and duties as the one it was copied from
                services.set_role_levels(key, services.role_levels(copy_from))
                services.set_role_duties(key, services.role_duties(copy_from))
            log_action(request.user, AuditLog.ACTION_CREATE, role, request=request)
        return Response(_role_row(role, {}), status=201)


class RoleDetailView(APIView):
    """PATCH {name, description}: rename a role an admin added. DELETE: remove one that nobody has."""
    permission_classes = MANAGER

    def _role(self, pk):
        role = get_object_or_404(Role, pk=pk)
        if role.is_system:
            raise ValidationError('The built-in roles can\'t be renamed or deleted. Their pages and duties can be changed.')
        return role

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk):
        role = self._role(pk)
        before = {'name': role.name, 'description': role.description}
        if 'name' in request.data:
            name = ' '.join(str(request.data.get('name') or '').split())
            if not name or len(name) > 80:
                raise ValidationError({'name': ['Enter a name of at most 80 characters.']})
            if Role.objects.filter(name__iexact=name).exclude(pk=role.pk).exists():
                raise ValidationError({'name': ['There is already a role with this name.']})
            role.name = name
        if 'description' in request.data:
            role.description = str(request.data.get('description') or '')[:255]
        role.save()
        services.forget_roles()
        changes = {f: {'old': old, 'new': getattr(role, f)} for f, old in before.items() if getattr(role, f) != old}
        if changes:
            log_action(request.user, AuditLog.ACTION_UPDATE, role, request=request, changes=changes)
        return Response(_role_row(role, _user_counts()))

    @extend_schema(responses=None)
    def delete(self, request, pk):
        role = self._role(pk)
        users = CustomUser.objects.filter(role=role.key).count()
        if users:
            raise ValidationError(f'{users} user(s) have this role. Give them another role first.')
        with transaction.atomic():
            RolePage.objects.filter(role=role.key).delete()
            RoleDuty.objects.filter(role=role.key).delete()
            log_action(request.user, AuditLog.ACTION_DELETE, role, request=request)
            role.delete()
            services.forget_roles()
        return Response(status=204)
