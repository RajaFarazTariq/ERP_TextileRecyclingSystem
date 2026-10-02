from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.core.permissions import ALL_ROLES, IsAdminUser, get_role
from . import approvals, rules
from .models import NotificationRule
from .serializers import NotificationRuleSerializer


class IsAnyRole(permissions.BasePermission):
    """Any logged-in role; the rules decide what each one sees."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_role(request.user) in ALL_ROLES)


class NotificationsView(APIView):
    """What needs the caller's attention right now: escalated first, then by severity."""
    permission_classes = [IsAuthenticated, IsAnyRole]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(rules.current_items(request.user))


class NotificationRuleViewSet(AuditedModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                              mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """The rules are fixed (one per kind of alert); an admin changes their settings."""
    queryset = NotificationRule.objects.all()
    serializer_class = NotificationRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']


class ApprovalsView(APIView):
    """Everything waiting for an admin's decision, grouped by kind."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(approvals.pending())
