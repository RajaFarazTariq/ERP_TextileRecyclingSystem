from rest_framework import permissions


class IsWarehouseSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in
            ['warehouse_supervisor', 'admin']
        )


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'admin'
        )