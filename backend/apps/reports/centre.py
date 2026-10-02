"""
Report centre and executive dashboard endpoints (admin only).

  GET /api/reports/catalogue/                 the list of reports
  GET /api/reports/run/<key>/                 one report as a table (DateFilter params, or start and end)
  GET /api/reports/run/<key>/?format=xlsx     the same table as an Excel file
  GET /api/reports/run/<key>/?format=csv      the same table as a CSV file
  GET /api/reports/schedules/                 the scheduled e-mail reports and how they are run
  GET /api/reports/executive/                 key figures of every module for the dashboard
"""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPage
from . import exports, services

ADMIN = [IsAuthenticated, HasPage('reports', 'dashboard')]


class JsonOnly(DefaultContentNegotiation):
    """`?format=` chooses the file here, so it must not be read as a renderer name."""

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class CatalogueView(APIView):
    permission_classes = ADMIN

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({'groups': services.GROUPS, 'reports': services.catalogue()})


class RunReportView(APIView):
    permission_classes = ADMIN
    content_negotiation_class = JsonOnly

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, key):
        wanted = request.query_params.get('format', 'json')
        if wanted not in ('json', 'xlsx', 'csv'):
            raise ValidationError({'format': ['Choose json, xlsx or csv.']})
        report = services.run(key, request.query_params, request.user)
        if wanted == 'xlsx':
            return exports.xlsx_response(report)
        if wanted == 'csv':
            return exports.csv_response(report)
        return Response(report)


class SchedulesView(APIView):
    permission_classes = ADMIN

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.schedules())


class ExecutiveView(APIView):
    permission_classes = ADMIN

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.executive(request.user))
