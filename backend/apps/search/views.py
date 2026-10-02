from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import SharedReadPermission
from apps.sorting.models import FabricStock
from . import finder, trace


class SearchView(APIView):
    """
    Find records across the modules: ?q=<two or more characters>.
    ?scope=lots keeps only records that lead to a fabric lot (for traceability).
    Each role gets only the kinds of record it can open.
    """
    permission_classes = [IsAuthenticated, SharedReadPermission]

    @extend_schema(parameters=[OpenApiParameter('q', str), OpenApiParameter('scope', str)],
                   responses=OpenApiTypes.OBJECT)
    def get(self, request):
        params = request.query_params
        return Response(finder.search(request.user, params.get('q', ''), lots_only=params.get('scope') == 'lots'))


class TraceView(APIView):
    """
    The full history of a fabric lot: ?lot=<id>, or ?order=<sales order id>,
    ?stock=<delivery id>, ?production=<production order id>. A delivery split
    into several lots lists them in `matches` and traces the first.
    """
    permission_classes = [IsAuthenticated, SharedReadPermission]

    @extend_schema(parameters=[OpenApiParameter(name, int) for name in trace.LOOKUPS],
                   responses=OpenApiTypes.OBJECT)
    def get(self, request):
        ids = trace.resolve_lots(request)
        data = trace.build(request, ids[0])
        lots = FabricStock.objects.filter(pk__in=ids).order_by('pk') if len(ids) > 1 else []
        data['matches'] = [{'id': lot.pk, 'material_type': lot.material_type, 'status': lot.status} for lot in lots]
        return Response(data)
