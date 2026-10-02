# core/permissions.py
"""
Central Role-Based Access Control (RBAC) for Textile ERP.

─────────────────────────────────────────────────────────
ROLE HIERARCHY
─────────────────────────────────────────────────────────
  admin                     → full access to everything
  warehouse_supervisor      → warehouse + shared reads
  sorting_supervisor        → sorting + shared reads
  decolorization_supervisor → decolorization + shared reads
  drying_supervisor         → drying + shared reads

SHARED READ RULE
─────────────────────────────────────────────────────────
  Any authenticated user can READ (GET/HEAD/OPTIONS)
  cross-module data they need to do their job.
  Only WRITE operations (POST/PUT/PATCH/DELETE) are
  restricted to the owning role + admin.

─────────────────────────────────────────────────────────
HOW TO USE
─────────────────────────────────────────────────────────
  # In any views.py:
  from apps.core.permissions import IsAdminUser, IsWarehouseSupervisor, \
      IsSortingSupervisor, IsDecolorizationSupervisor, \
      IsDryingSupervisor, SharedReadPermission

  class MyViewSet(ModelViewSet):
      permission_classes = [IsAuthenticated, SharedReadPermission]

  # For strict module ownership:
      permission_classes = [IsAuthenticated, IsSortingSupervisor]
─────────────────────────────────────────────────────────
"""

from rest_framework import permissions

# ── All valid roles ───────────────────────────────────────────────────────────
class _AllRoles:
    """
    The keys of every role, built-in or added by an admin (apps.access.Role).
    Behaves like the set it used to be: `role in ALL_ROLES`, iteration and
    `ALL_ROLES - {...}` all work.
    """

    def _keys(self):
        from apps.access.services import role_keys
        return set(role_keys())

    def __contains__(self, role):
        return role in self._keys()

    def __iter__(self):
        return iter(self._keys())

    def __len__(self):
        return len(self._keys())

    def __sub__(self, other):
        return self._keys() - set(other)


ALL_ROLES = _AllRoles()

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def get_role(user):
    """Return the user's role string, or None."""
    return getattr(user, 'role', None)


def is_admin(user):
    return get_role(user) == 'admin'


def has_duty(user, *duties):
    """True when the user's role carries one of these duties (see apps.access.services.DUTIES). Admins carry all."""
    from apps.access.services import has_duty as _has_duty
    return _has_duty(user, *duties)


def HasDuty(*duties, message='Your role is not allowed to do this.'):
    """Permission class for an action that needs a duty, e.g. approving purchases."""
    text = message

    class _HasDuty(permissions.BasePermission):
        message = text

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated and has_duty(request.user, *duties))

    _HasDuty.__name__ = 'HasDuty_' + '_'.join(duties)
    return _HasDuty


def has_page(user, *pages):
    """True when the user may open one of these pages (see apps.access.services)."""
    from apps.access.services import has_page as _has_page
    return _has_page(user, *pages)


def can_edit(user, *pages):
    """True when the user has one of these pages in full (not view-only)."""
    from apps.access.services import can_edit as _can_edit
    return _can_edit(user, *pages)


def page_allows(request, *pages):
    """Reading needs one of these pages at any level; changing needs one in full."""
    if not request.user or not request.user.is_authenticated:
        return False
    return has_page(request.user, *pages) if request.method in SAFE_METHODS else can_edit(request.user, *pages)


def HasPage(*pages):
    """Permission class: the module belongs to whoever has one of these pages (in full, to change anything)."""
    class _HasPage(permissions.BasePermission):
        message = 'You do not have access to this part of the system.'

        def has_permission(self, request, view):
            return page_allows(request, *pages)

    _HasPage.__name__ = 'HasPage_' + '_'.join(pages)
    return _HasPage


# ── Base mixin ────────────────────────────────────────────────────────────────

class RolePermissionBase(permissions.BasePermission):
    """
    Base class. Subclasses set `allowed_roles`.
    Admin always passes. Allowed roles pass on all methods.
    """
    allowed_roles: set = set()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        return role == 'admin' or role in self.allowed_roles


# ── Individual role permissions ───────────────────────────────────────────────

class IsAdminUser(RolePermissionBase):
    """Admin only."""
    allowed_roles = {'admin'}

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            is_admin(request.user)
        )


class IsWarehouseSupervisor(RolePermissionBase):
    allowed_roles = {'warehouse_supervisor'}


class IsSortingSupervisor(RolePermissionBase):
    allowed_roles = {'sorting_supervisor'}


class IsDecolorizationSupervisor(RolePermissionBase):
    allowed_roles = {'decolorization_supervisor'}


class IsDryingSupervisor(RolePermissionBase):
    message = 'You do not have permission to access the Drying module.'
    allowed_roles = {'drying_supervisor'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            # Who may read is decided by the pages that show drying data (Drying, Dashboard): see access.PAGE_API
            return get_role(request.user) in ALL_ROLES
        return can_edit(request.user, 'drying')


# ── KEY PERMISSION: SharedReadPermission ──────────────────────────────────────

class SharedReadPermission(permissions.BasePermission):
    """
    THE SOLUTION TO THE CROSS-MODULE 403 PROBLEM.

    Rule:
      - Any authenticated user with a valid role can READ (GET/HEAD/OPTIONS)
        any endpoint. This lets sorting supervisors read warehouse stock,
        users list, etc. without getting 403s.
      - WRITE operations (POST/PUT/PATCH/DELETE) are restricted to admin only
        UNLESS the ViewSet overrides with a more specific permission.

    Usage:
      Use this as the BASE permission on ViewSets where cross-module reads
      are needed. Pair with a role-specific permission for write control:

        permission_classes = [IsAuthenticated, SharedReadPermission]

      For full module ownership (reads + writes for role):
        permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]
    """
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        # Any valid role can read
        if request.method in SAFE_METHODS:
            return True
        # Only admin can write on generic shared endpoints
        return role == 'admin'


# ── Module-aware permissions (READ for all, WRITE for owner + admin) ──────────

class IsWarehouseOrAdmin(RolePermissionBase):
    """
    Read: any authenticated role.
    Write: warehouse_supervisor or admin.
    """
    allowed_roles = {'warehouse_supervisor'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True           # all roles can read warehouse data
        return can_edit(request.user, 'warehouse')   # whoever has the page in full may change its records


class IsSortingOrAdmin(RolePermissionBase):
    """
    Read: any authenticated role.
    Write: sorting_supervisor or admin.
    """
    allowed_roles = {'sorting_supervisor'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True
        return can_edit(request.user, 'sorting')   # whoever has the page in full may change its records


class IsDecolorizationOrAdmin(RolePermissionBase):
    """
    Read: any authenticated role.
    Write: decolorization_supervisor or admin.
    """
    allowed_roles = {'decolorization_supervisor'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True
        return can_edit(request.user, 'decolorization')   # whoever has the page in full may change its records


class IsDryingOrAdmin(RolePermissionBase):
    """
    Read: any authenticated role.
    Write: drying_supervisor or admin.
    """
    allowed_roles = {'drying_supervisor'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True
        return can_edit(request.user, 'drying')   # whoever has the page in full may change its records


class IsSalesOrAdmin(RolePermissionBase):
    """Sales endpoints — admin only for writes, all roles can read."""
    allowed_roles = {'admin'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True
        return can_edit(request.user, 'sales')


class IsUsersOrAdmin(permissions.BasePermission):
    """
    Users list — all authenticated roles can READ (needed for dropdowns).
    Only admin can CREATE/UPDATE/DELETE users.
    """
    message = 'Only admins can manage users.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = get_role(request.user)
        if role not in ALL_ROLES:
            return False
        if request.method in SAFE_METHODS:
            return True
        return role == 'admin'