from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import is_admin
from . import services
from .models import Document, DocumentCategory, DocumentVersion


class CategorySerializer(serializers.ModelSerializer):
    allowed_roles = serializers.ListField(child=serializers.CharField(), required=False)
    documents = serializers.IntegerField(source='documents.count', read_only=True)

    class Meta:
        model = DocumentCategory
        fields = ['id', 'name', 'description', 'allowed_roles', 'is_active', 'documents']

    def validate_allowed_roles(self, roles):
        unknown = sorted(set(roles) - set(services.ROLE_KEYS) - {'admin'})
        if unknown:
            raise serializers.ValidationError(f'Unknown role: {", ".join(unknown)}.')
        # Admins always have access, so the list holds the other roles only
        return [r for r in services.ROLE_KEYS if r in roles]


class VersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = DocumentVersion
        fields = ['id', 'version', 'original_name', 'extension', 'size_bytes', 'content_type', 'sha256', 'note',
                  'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = fields


class DocumentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=False)
    note = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    status = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    extension = serializers.SerializerMethodField()
    size_bytes = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()
    can_change = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ['id', 'number', 'title', 'category', 'category_name', 'description', 'reference_number',
                  'issued_on', 'expires_on', 'status', 'days_left', 'linked_type', 'linked_id', 'linked_label',
                  'current_version', 'file_name', 'extension', 'size_bytes', 'updated_at', 'can_change',
                  'created_by', 'created_by_name', 'created_at', 'file', 'note']
        read_only_fields = ['number', 'current_version', 'created_by', 'created_at']

    # ── Read ────────────────────────────────────────────────────────────────

    def _current(self, document):
        # versions are prefetched, newest first
        return next((v for v in document.versions.all() if v.version == document.current_version), None)

    def get_status(self, document) -> str:
        return services.status_of(document)

    def get_days_left(self, document) -> int | None:
        return (document.expires_on - timezone.localdate()).days if document.expires_on else None

    def get_file_name(self, document) -> str:
        version = self._current(document)
        return version.original_name if version else ''

    def get_extension(self, document) -> str:
        version = self._current(document)
        return version.extension if version else ''

    def get_size_bytes(self, document) -> int:
        version = self._current(document)
        return version.size_bytes if version else 0

    def get_updated_at(self, document):
        version = self._current(document)
        return (version.uploaded_at if version else document.created_at).isoformat()

    def get_can_change(self, document) -> bool:
        request = self.context.get('request')
        return bool(request and services.may_change(request.user, document))

    # ── Write ───────────────────────────────────────────────────────────────

    def validate(self, data):
        user = self.context['request'].user
        document = self.instance
        if document is None:
            if not data.get('file'):
                raise serializers.ValidationError({'file': ['Choose a file to upload.']})
            services.check_category(user, data['category'])
        else:
            services.check_may_change(user, document)
            if 'category' in data and data['category'] != document.category:
                # Moving a document changes who can see it
                if not is_admin(user):
                    raise PermissionDenied('Only an admin can move a document to another category.')
                services.check_category(user, data['category'])

        issued = data.get('issued_on', getattr(document, 'issued_on', None))
        expires = data.get('expires_on', getattr(document, 'expires_on', None))
        if issued and expires and expires < issued:
            raise serializers.ValidationError({'expires_on': ["The expiry date can't be before the issue date."]})

        linked_type = data.get('linked_type', getattr(document, 'linked_type', ''))
        if not linked_type:
            if 'linked_type' in data:
                data['linked_id'], data['linked_label'] = None, ''
        elif not (data.get('linked_label', getattr(document, 'linked_label', ''))
                  or data.get('linked_id', getattr(document, 'linked_id', None))):
            raise serializers.ValidationError({'linked_label': ['Say which record this document belongs to.']})
        return data

    @transaction.atomic
    def create(self, validated):
        upload = validated.pop('file')
        note = validated.pop('note', '')
        document = Document.objects.create(**validated)
        services.add_version(document, upload, validated['created_by'], note)
        document.refresh_from_db()
        return document

    def update(self, instance, validated):
        # A new file is a new version (POST .../versions/), never an edit
        validated.pop('file', None)
        validated.pop('note', None)
        return super().update(instance, validated)
