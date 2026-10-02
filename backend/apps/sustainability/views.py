from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.core.filters import filter_by_date_params
from apps.core.permissions import ALL_ROLES, SAFE_METHODS, SharedReadPermission, get_role, is_admin
from . import services
from .models import SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord
from .serializers import (
    TargetSerializer, UtilityReadingSerializer, WasteCategorySerializer, WasteRecordSerializer,
)


class IsRecorder(permissions.BasePermission):
    """Every role reads and adds entries. A supervisor changes only their own; deleting is for admins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or get_role(request.user) not in ALL_ROLES:
            return False
        self.message = 'Only an admin can delete this.'
        return request.method != 'DELETE' or is_admin(request.user)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS or is_admin(request.user):
            return True
        self.message = 'You can only change entries you recorded yourself.'
        return obj.recorded_by_id == request.user.pk


class WasteCategoryViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Kinds of waste. Everyone reads them; admins maintain them."""
    queryset = WasteCategory.objects.prefetch_related('records')
    serializer_class = WasteCategorySerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]


class WasteRecordViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = WasteRecordSerializer
    permission_classes = [IsAuthenticated, IsRecorder]

    def get_queryset(self):
        qs = WasteRecord.objects.select_related('category', 'fabric', 'recorded_by')
        params = self.request.query_params
        if classification := params.get('classification'):
            qs = qs.filter(category__classification=classification)
        if stage := params.get('stage'):
            qs = qs.filter(stage=stage)
        if category := params.get('category'):
            qs = qs.filter(category_id=category)
        if method := params.get('disposal_method'):
            qs = qs.filter(disposal_method=method)
        return filter_by_date_params(qs, params, 'date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, recorded_by=self.request.user)


class UtilityReadingViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = UtilityReadingSerializer
    permission_classes = [IsAuthenticated, IsRecorder]

    def get_queryset(self):
        qs = UtilityReading.objects.select_related('recorded_by')
        params = self.request.query_params
        if utility := params.get('utility'):
            qs = qs.filter(utility=utility)
        if stage := params.get('stage'):
            qs = qs.filter(stage=stage)
        return filter_by_date_params(qs, params, 'date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, recorded_by=self.request.user)


class TargetViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Goals for the calculated figures. Everyone reads them; admins maintain them."""
    queryset = SustainabilityTarget.objects.all()
    serializer_class = TargetSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]


class SustainabilitySummaryView(APIView):
    """Dashboard figures for a period (this month unless a period is sent), plus the monthly trend."""
    permission_classes = [IsAuthenticated, SharedReadPermission]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        months = 6 if request.query_params.get('months') == '6' else 12
        data = services.figures(services.with_default_period(request.query_params))
        data['trend'] = services.trend(months)
        return Response(data)


class SustainabilityReportView(APIView):
    """The environmental report for a period (all time unless a period is sent)."""
    permission_classes = [IsAuthenticated, SharedReadPermission]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.figures(request.query_params))
