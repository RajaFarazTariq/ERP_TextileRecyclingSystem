from collections import defaultdict
from datetime import date

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog, log_action
from apps.core.filters import filter_by_date_params
from apps.core.permissions import ALL_ROLES, SharedReadPermission, get_role, has_duty, is_admin
from . import services
from .models import CorrectiveAction, Inspection, QualityStandard
from .serializers import CorrectiveActionSerializer, InspectionSerializer, StandardSerializer


class IsQualityUser(permissions.BasePermission):
    """Every role reads and records quality data (the serializers check the stage); deleting is for admins."""
    message = 'Only an admin can delete quality records.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or get_role(request.user) not in ALL_ROLES:
            return False
        return request.method != 'DELETE' or is_admin(request.user)


class IsAdminAction(permissions.BasePermission):
    message = 'Your role is not allowed to release material from quarantine.'

    def has_permission(self, request, view):
        return has_duty(request.user, 'release_quarantine')


note_request = inline_serializer('QualityNoteRequest', {'note': serializers.CharField(required=False)})


class StandardViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Checklists with limits. Everyone reads them; admins maintain them."""
    serializer_class = StandardSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]

    def get_queryset(self):
        qs = QualityStandard.objects.prefetch_related('checks', 'inspections')
        if stage := self.request.query_params.get('stage'):
            qs = qs.filter(stage=stage)
        return qs


def _inspections():
    return (Inspection.objects
            .select_related('stock__vendor', 'fabric__stock__vendor', 'standard', 'inspector', 'released_by')
            .prefetch_related('results', 'actions__owner', 'actions__created_by', 'actions__inspection'))


class InspectionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = InspectionSerializer
    permission_classes = [IsAuthenticated, IsQualityUser]

    def get_queryset(self):
        qs = _inspections()
        params = self.request.query_params
        if stage := params.get('stage'):
            qs = qs.filter(stage=stage)
        if result := params.get('result'):
            qs = qs.filter(result=result)
        if params.get('quarantined'):
            qs = qs.filter(result='Fail', released_at__isnull=True)
        if stock := params.get('stock'):
            qs = qs.filter(stock_id=stock)
        if fabric := params.get('fabric'):
            qs = qs.filter(fabric_id=fabric)
        return filter_by_date_params(qs, params, 'inspected_on')

    def perform_create(self, serializer):
        return super().perform_create(serializer, inspector=self.request.user)

    @extend_schema(request=note_request, responses=InspectionSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminAction])
    def release(self, request, pk=None):
        """End the quarantine of a failed delivery or lot."""
        inspection = self.get_object()
        services.release(inspection, request.user, str(request.data.get('note', '')))
        log_action(request.user, AuditLog.ACTION_UPDATE, inspection, request=request,
                   changes={'quarantine': {'old': 'In quarantine', 'new': 'Released'}})
        return Response(self.get_serializer(self.get_queryset().get(pk=inspection.pk)).data)


class CorrectiveActionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = CorrectiveActionSerializer
    permission_classes = [IsAuthenticated, IsQualityUser]

    def get_queryset(self):
        qs = CorrectiveAction.objects.select_related('inspection', 'owner', 'created_by')
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if inspection := params.get('inspection'):
            qs = qs.filter(inspection_id=inspection)
        return qs

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    def _set_status(self, request, done):
        item = self.get_object()
        services.check_may_inspect(request.user, item.inspection.stage)
        if (item.status == 'Done') == done:
            raise ValidationError({'status': [f'This action is already {"done" if done else "open"}.']})
        before = self.snapshot(item)
        item.status = 'Done' if done else 'Open'
        item.completed_at = timezone.now() if done else None
        item.completion_note = str(request.data.get('note', '')).strip() if done else ''
        item.save()
        self.log_change(item, before)
        return Response(self.get_serializer(item).data)

    @extend_schema(request=note_request, responses=CorrectiveActionSerializer)
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        return self._set_status(request, True)

    @extend_schema(request=None, responses=CorrectiveActionSerializer)
    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        return self._set_status(request, False)


def _months_back(today, n):
    """First days of the last n months, oldest first."""
    year, month = today.year, today.month
    months = []
    for _ in range(n):
        months.append(date(year, month, 1))
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return months[::-1]


def _pct(part, whole):
    return round(part / whole * 100, 1) if whole else None


class QualitySummaryView(APIView):
    """Figures for the Quality dashboard: this month, trend, defects and supplier quality."""
    permission_classes = [IsAuthenticated, IsQualityUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = timezone.localdate()
        months = _months_back(today, 6)
        inspections = list(Inspection.objects.filter(inspected_on__gte=months[0])
                           .select_related('stock__vendor').prefetch_related('results'))

        this_month = [i for i in inspections if i.inspected_on >= months[-1]]
        trend = {m: {'month': m.strftime('%Y-%m'), 'Pass': 0, 'Conditional': 0, 'Fail': 0} for m in months}
        stages = {s: {'stage': s, 'Pass': 0, 'Conditional': 0, 'Fail': 0} for s in services.STAGE_ROLES}
        defects = defaultdict(lambda: {'checks': 0, 'failures': 0})
        suppliers = {}
        for i in inspections:
            trend[i.inspected_on.replace(day=1)][i.result] += 1
            stages[i.stage][i.result] += 1
            for r in i.results.all():
                defects[r.name]['checks'] += 1
                defects[r.name]['failures'] += int(not r.passed)
            if i.stage == 'Incoming':
                row = suppliers.setdefault(i.stock.vendor_id, {
                    'vendor': i.stock.vendor_id, 'name': i.stock.vendor.name, 'inspections': 0, 'failed': 0})
                row['inspections'] += 1
                row['failed'] += int(i.result == 'Fail')
        for row in suppliers.values():
            row['pass_pct'] = _pct(row['inspections'] - row['failed'], row['inspections'])

        actions = CorrectiveAction.objects.filter(status='Open')
        return Response({
            'inspections_this_month': len(this_month),
            'pass_pct_this_month': _pct(sum(1 for i in this_month if i.result != 'Fail'), len(this_month)),
            'conditional_this_month': sum(1 for i in this_month if i.result == 'Conditional'),
            'failed_this_month': sum(1 for i in this_month if i.result == 'Fail'),
            'quarantined': Inspection.objects.filter(result='Fail', released_at__isnull=True).count(),
            'open_actions': actions.count(),
            'overdue_actions': actions.filter(due_date__lt=today).count(),
            'trend': list(trend.values()),
            'stages': list(stages.values()),
            'defects': sorted(
                ({'name': name, **d, 'failure_pct': _pct(d['failures'], d['checks'])}
                 for name, d in defects.items() if d['failures']),
                key=lambda d: (-d['failures'], d['name']))[:8],
            'suppliers': sorted(suppliers.values(), key=lambda r: (r['pass_pct'], r['name'])),
        })
