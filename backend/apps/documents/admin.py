from django.contrib import admin

from .models import Document, DocumentCategory, DocumentVersion


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'allowed_roles', 'is_active']
    list_filter = ['is_active']


class DocumentVersionInline(admin.TabularInline):
    model = DocumentVersion
    extra = 0
    # Files are added through the app, where they are checked
    readonly_fields = ['version', 'file', 'original_name', 'extension', 'size_bytes', 'content_type', 'sha256',
                       'uploaded_by', 'uploaded_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['number', 'title', 'category', 'expires_on', 'current_version', 'created_by', 'created_at']
    list_filter = ['category', 'linked_type']
    search_fields = ['number', 'title', 'reference_number', 'linked_label']
    inlines = [DocumentVersionInline]
