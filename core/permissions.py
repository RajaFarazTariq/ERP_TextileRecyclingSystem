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
  from core.permissions import IsAdminUser, IsWarehouseSupervisor, \
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
ALL_ROLES = {
    'admin',
    'warehouse_supervisor',
    'sorting_supervisor',
    'decolorization_supervisor',
    'drying_supervisor',
}

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def get_role(user):
    """Return the user's role string, or None."""
    return getattr(user, 'role', None)


def is_admin(user):
    return get_role(user) == 'admin'


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
    allowed_roles = {'drying_supervisor'}


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
        return role in {'admin', 'warehouse_supervisor'}


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
        return role in {'admin', 'sorting_supervisor'}


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
        return role in {'admin', 'decolorization_supervisor'}


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
        return role in {'admin', 'drying_supervisor'}


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
        return role == 'admin'


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