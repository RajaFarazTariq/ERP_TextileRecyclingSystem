"""
Documents: one place for the factory's files (certificates, test reports,
safety data sheets, supplier, customer and employee papers).

A document belongs to a category, and the category says which roles may see
it. Every upload is a `DocumentVersion`; older versions stay downloadable.
Files are stored under MEDIA_ROOT with a generated name and are only served
through the API, after a permission check.

A document can point to a record in another module (`linked_type`,
`linked_id`, `linked_label`). The link is stored as plain values, so this app
depends on no other module.
"""
import uuid

from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

LINK_CHOICES = [(name, name) for name in (
    'Supplier', 'Purchase order', 'Customer', 'Sales order', 'Invoice', 'Fabric lot',
    'Production order', 'Inspection', 'Chemical', 'Employee', 'Machine', 'Other',
)]


def upload_path(instance, filename):
    """Where a file is stored: a generated name. The name the user gave is never part of the path."""
    return f'documents/{uuid.uuid4().hex}.bin'


class DocumentCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, default='')
    # Role keys that may see documents of this category. Admins always may.
    allowed_roles = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'document categories'

    def __str__(self):
        return self.name


class Document(NumberedModel):
    PREFIX = 'DOC'

    title = models.CharField(max_length=200)
    category = models.ForeignKey(DocumentCategory, on_delete=models.PROTECT, related_name='documents')
    description = models.TextField(blank=True, default='')
    reference_number = models.CharField(max_length=100, blank=True, default='',
                                        help_text='The number printed on the document, e.g. a certificate number')
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    linked_type = models.CharField(max_length=20, choices=LINK_CHOICES, blank=True, default='')
    linked_id = models.PositiveBigIntegerField(null=True, blank=True)
    linked_label = models.CharField(max_length=200, blank=True, default='')
    current_version = models.PositiveIntegerField(default=0, editable=False)
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='documents')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['linked_type', 'linked_id']), models.Index(fields=['expires_on'])]

    def __str__(self):
        return f'{self.number or "Document"} {self.title}'


class DocumentVersion(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version = models.PositiveIntegerField()
    file = models.FileField(upload_to=upload_path, max_length=120)
    # The name the user gave. Used only as the suggested name of a download.
    original_name = models.CharField(max_length=255)
    extension = models.CharField(max_length=10)
    size_bytes = models.PositiveBigIntegerField()
    content_type = models.CharField(max_length=100)
    sha256 = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default='', help_text='What changed in this version')
    uploaded_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        constraints = [models.UniqueConstraint(fields=['document', 'version'], name='unique_document_version')]

    def __str__(self):
        return f'{self.document.number} v{self.version}'


@receiver(post_delete, sender=DocumentVersion)
def remove_file(sender, instance, **kwargs):
    """Remove the stored file once the deletion is final."""
    name = instance.file.name
    if name:
        storage = instance.file.storage
        transaction.on_commit(lambda: storage.delete(name))
