from rest_framework import permissions


class IsSalesUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in
            ['admin']
        )