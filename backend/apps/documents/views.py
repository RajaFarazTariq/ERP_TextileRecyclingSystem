from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog, log_action
from apps.core.permissions import ALL_ROLES, SharedReadPermission, get_role, is_admin
from . import services
from .models import Document
from .serializers import CategorySerializer, DocumentSerializer, VersionSerializer


class IsDocumentUser(permissions.BasePermission):
    """Every role uses Documents (what they see depends on the category); deleting is for admins."""
    message = 'Only an admin can delete documents.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or get_role(request.user) not in ALL_ROLES:
            return False
        return request.method != 'DELETE' or is_admin(request.user)


class CategoryViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Admins maintain the categories and who may see them. Other roles see only their own categories."""
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]

    def get_queryset(self):
        return services.visible_categories(self.request.user).prefetch_related('documents')


def send_file(request, version):
    """Stream one stored file as a download. Never shown inside the browser."""
    try:
        stored = version.file.open('rb')
    except (FileNotFoundError, ValueError):
        raise NotFound('The file of this document is missing from storage.')
    log_action(request.user, AuditLog.ACTION_EXPORT, version.document, request=request,
               changes={'downloaded': {'old': None, 'new': f'Version {version.version}: {version.original_name}'}})
    response = FileResponse(
        stored, as_attachment=True, filename=services.download_name(version),
        content_type=services.CONTENT_TYPES.get(version.extension, 'application/octet-stream'))
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'private, no-store'
    return response


class DocumentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """
    Documents the user may see. A document outside the user's categories
    answers 404, the same as one that doesn't exist.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsDocumentUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = services.visible_documents(self.request.user)
        params = self.request.query_params
        if category := params.get('category'):
            qs = qs.filter(category_id=category) if category.isdigit() else qs.none()
        if state := params.get('status'):
            qs = services.filter_status(qs, state)
        if linked_type := params.get('linked_type'):
            qs = qs.filter(linked_type=linked_type)
        if linked_id := params.get('linked_id'):
            qs = qs.filter(linked_id=linked_id) if linked_id.isdigit() else qs.none()
        if text := params.get('search', '').strip():
            qs = qs.filter(
                Q(title__icontains=text) | Q(number__icontains=text) | Q(reference_number__icontains=text)
                | Q(description__icontains=text) | Q(linked_label__icontains=text)
                | Q(category__name__icontains=text) | Q(versions__original_name__icontains=text)
            ).distinct()
        return qs

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    @extend_schema(responses=VersionSerializer(many=True))
    @action(detail=True, methods=['get', 'post'])
    def versions(self, request, pk=None):
        """List the versions, or upload a file as the next version."""
        document = self.get_object()
        if request.method == 'POST':
            services.check_may_change(request.user, document)
            upload = request.FILES.get('file')
            if not upload:
                raise ValidationError({'file': ['Choose a file to upload.']})
            version = services.add_version(document, upload, request.user, request.data.get('note', ''))
            log_action(request.user, AuditLog.ACTION_UPDATE, document, request=request,
                       changes={'current_version': {'old': version.version - 1, 'new': version.version}})
            return Response(VersionSerializer(version).data, status=status.HTTP_201_CREATED)
        return Response(VersionSerializer(document.versions.all(), many=True).data)

    def _version(self, document, number):
        version = next((v for v in document.versions.all() if v.version == number), None)
        if version is None:
            raise NotFound('This version does not exist.')
        return version

    @extend_schema(responses=OpenApiTypes.BINARY)
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download the current version."""
        document = self.get_object()
        return send_file(request, self._version(document, document.current_version))

    @extend_schema(responses=OpenApiTypes.BINARY)
    @action(detail=True, methods=['get'], url_path=r'versions/(?P<number>\d+)/download')
    def download_version(self, request, pk=None, number=None):
        """Download an earlier version."""
        return send_file(request, self._version(self.get_object(), int(number)))


class ExpiringView(APIView):
    """Documents that have expired or expire within `days` (default 30), soonest first."""
    permission_classes = [IsAuthenticated, IsDocumentUser]

    @extend_schema(responses=DocumentSerializer(many=True))
    def get(self, request):
        days = request.query_params.get('days', '')
        days = min(int(days), 3650) if days.isdigit() else services.EXPIRING_DAYS
        until = timezone.localdate() + timedelta(days=days)
        documents = services.visible_documents(request.user).filter(expires_on__lte=until).order_by('expires_on', 'id')
        return Response(DocumentSerializer(documents, many=True, context={'request': request}).data)


class DocumentSummaryView(APIView):
    """Figures for the Documents dashboard, counted over what the user may see."""
    permission_classes = [IsAuthenticated, IsDocumentUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = timezone.localdate()
        documents = Document.objects.filter(pk__in=services.visible_documents(request.user).values('pk'))
        by_status = {name: services.filter_status(documents, name, today).count() for name in services.STATUSES}
        by_category = (documents.values('category', 'category__name')
                       .annotate(count=Count('id')).order_by('-count', 'category__name'))
        return Response({
            'documents': documents.count(),
            'valid': by_status['Valid'],
            'expiring_soon': by_status['Expiring soon'],
            'expired': by_status['Expired'],
            'no_expiry': by_status['No expiry'],
            'added_this_month': documents.filter(created_at__date__gte=today.replace(day=1)).count(),
            'by_category': [{'category': row['category'], 'name': row['category__name'], 'count': row['count']}
                            for row in by_category],
            'expiring_days': services.EXPIRING_DAYS,
            'max_upload_mb': settings.DOCUMENT_MAX_UPLOAD_MB,
            'allowed_extensions': services.ALLOWED_EXTENSIONS,
        })
