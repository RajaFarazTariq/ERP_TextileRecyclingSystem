# drying/permissions.py
from rest_framework.permissions import BasePermission


class IsDryingSupervisor(BasePermission):
    """
    Allows access to:
      - admin
      - drying_supervisor
    """
    message = 'You do not have permission to access the Drying module.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return getattr(user, 'role', '') in ('admin', 'drying_supervisor')
