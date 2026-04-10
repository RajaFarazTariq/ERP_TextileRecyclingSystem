# drying/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from audit.middleware import AuditedModelMixin
from .models import Dryer, DryingSession
from .serializers import DryerSerializer, DryingSessionSerializer
from .permissions import IsDryingSupervisor


class DryerViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset           = Dryer.objects.all().order_by('name')
    serializer_class   = DryerSerializer
    permission_classes = [IsAuthenticated, IsDryingSupervisor]

    def get_queryset(self):
        qs = Dryer.objects.all().order_by('name')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def set_available(self, request, pk=None):
        dryer = self.get_object()
        dryer.status = 'Available'
        dryer.save()
        return Response({'message': f'{dryer.name} marked as Available.'})

    @action(detail=True, methods=['post'])
    def set_maintenance(self, request, pk=None):
        dryer = self.get_object()
        dryer.status = 'Maintenance'
        dryer.save()
        return Response({'message': f'{dryer.name} sent to Maintenance.'})


class DryingSessionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset           = DryingSession.objects.all().order_by('-created_at')
    serializer_class   = DryingSessionSerializer
    permission_classes = [IsAuthenticated, IsDryingSupervisor]

    def get_queryset(self):
        qs = DryingSession.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        session = self.get_object()
        if session.status not in ('Pending', 'On Hold'):
            return Response(
                {'error': 'Only Pending or On Hold sessions can be started.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status     = 'In Progress'
        session.start_date = timezone.now()
        session.save()

        # Mark dryer as running
        session.dryer.status = 'Running'
        session.dryer.save()

        return Response({'message': f'Drying session started on {session.dryer.name}.'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status == 'Completed':
            return Response(
                {'error': 'Session already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        output_qty = request.data.get('output_quantity', 0)
        waste_qty  = request.data.get('waste_quantity',  0)
        notes      = request.data.get('notes', session.notes or '')

        session.output_quantity = output_qty
        session.waste_quantity  = waste_qty
        session.status          = 'Completed'
        session.end_date        = timezone.now()
        session.notes           = notes
        session.save()

        # Mark dryer as cooling (not immediately available after run)
        session.dryer.status = 'Cooling'
        session.dryer.save()

        # Update fabric status — ready for sale
        fabric = session.fabric
        fabric.status = 'Sorted'   # Ready to be sold
        fabric.save()

        return Response({'message': 'Drying session completed. Dryer cooling down.'})


# ─────────────────────────────────────────────────────────────────────────────
# Fabric list endpoint — for drying session dropdowns
# Only shows fabric that came out of decolorization (Sent to Decolorization)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDryingSupervisor])
def fabric_for_drying(request):
    """
    Returns fabric stock that has been through decolorization
    and is ready for drying. Used in the Add Session dropdown.
    """
    from sorting.models import FabricStock
    fabrics = FabricStock.objects.filter(
        status='Sent to Decolorization'
    ).values('id', 'material_type', 'status', 'remaining_quantity')
    return Response(list(fabrics))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDryingSupervisor])
def decolor_sessions_for_drying(request):
    """
    Returns completed decolorization sessions that have not yet
    been linked to a drying session. Used in the Add Session dropdown.
    """
    from decolorization.models import DecolorizationSession
    # Completed decolor sessions not yet linked to any drying session
    linked_ids = DryingSession.objects.filter(
        decolor_session__isnull=False
    ).values_list('decolor_session_id', flat=True)

    sessions = DecolorizationSession.objects.filter(
        status='Completed'
    ).exclude(
        id__in=linked_ids
    ).select_related('tank', 'fabric').values(
        'id', 'tank__name', 'fabric__material_type',
        'output_quantity', 'end_date'
    )
    return Response(list(sessions))
