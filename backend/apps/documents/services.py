"""Rules of the Documents module: who sees what, what may be uploaded, versions and expiry."""
import hashlib
import os
import re
import zipfile
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.permissions import ALL_ROLES, get_role, is_admin
from .models import Document, DocumentCategory, DocumentVersion

EXPIRING_DAYS = 30
STATUSES = ['Valid', 'Expiring soon', 'Expired', 'No expiry']

# Roles a category can be opened to (admins always see everything)
ROLE_KEYS = sorted(ALL_ROLES - {'admin'})

DEFAULT_CATEGORIES = [
    ('Supplier documents', 'Registrations, agreements and other supplier papers', ['warehouse_supervisor']),
    ('Purchase documents', 'Purchase orders, quotations and delivery papers', ['warehouse_supervisor']),
    ('Production batch documents', 'Batch records and process sheets', ROLE_KEYS),
    ('Quality certificates', 'Certificates for materials, products and the factory', ROLE_KEYS),
    ('Material test reports', 'Laboratory and in-house test results', ROLE_KEYS),
    ('Safety data sheets', 'Handling and hazard information for chemicals', ROLE_KEYS),
    ('Customer documents', 'Agreements and other customer papers', []),
    ('Invoices and delivery challans', 'Sales invoices and delivery challans', []),
    ('Employee documents', 'Contracts, identity papers and training records', []),
]

# Allowed extension -> the content type a download is sent with
CONTENT_TYPES = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv; charset=utf-8',
    'txt': 'text/plain; charset=utf-8',
}
ALLOWED_EXTENSIONS = list(CONTENT_TYPES)

OLE_HEADER = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
ZIP_FOLDER = {'docx': 'word/', 'xlsx': 'xl/'}


# ── Access ──────────────────────────────────────────────────────────────────

def ensure_default_categories():
    for name, description, roles in DEFAULT_CATEGORIES:
        DocumentCategory.objects.get_or_create(
            name=name, defaults={'description': description, 'allowed_roles': list(roles)})


def visible_categories(user):
    """Categories whose documents this user may see."""
    categories = DocumentCategory.objects.all()
    if is_admin(user):
        return categories
    role = get_role(user)
    return categories.filter(pk__in=[c.pk for c in categories if role in (c.allowed_roles or [])])


def visible_documents(user):
    documents = Document.objects.select_related('category', 'created_by').prefetch_related('versions__uploaded_by')
    if is_admin(user):
        return documents
    return documents.filter(category__in=visible_categories(user))


def may_change(user, document):
    """Admins change any document; other users only the ones they uploaded."""
    return is_admin(user) or document.created_by_id == user.pk


def check_may_change(user, document):
    if not may_change(user, document):
        raise PermissionDenied('Only an admin or the person who uploaded this document can change it.')


def check_category(user, category):
    """A new document goes into a category that is in use and that the user may see."""
    if not is_admin(user) and get_role(user) not in (category.allowed_roles or []):
        raise ValidationError({'category': ['Choose a category you have access to.']})
    if not category.is_active:
        raise ValidationError({'category': ['This category is no longer in use.']})


# ── Expiry ──────────────────────────────────────────────────────────────────

def status_of(document, today=None):
    if document.expires_on is None:
        return 'No expiry'
    today = today or timezone.localdate()
    if document.expires_on < today:
        return 'Expired'
    if document.expires_on <= today + timedelta(days=EXPIRING_DAYS):
        return 'Expiring soon'
    return 'Valid'


def filter_status(queryset, status, today=None):
    today = today or timezone.localdate()
    soon = today + timedelta(days=EXPIRING_DAYS)
    if status == 'No expiry':
        return queryset.filter(expires_on__isnull=True)
    if status == 'Expired':
        return queryset.filter(expires_on__lt=today)
    if status == 'Expiring soon':
        return queryset.filter(expires_on__gte=today, expires_on__lte=soon)
    if status == 'Valid':
        return queryset.filter(expires_on__gt=soon)
    return queryset.none()


# ── Uploads ─────────────────────────────────────────────────────────────────

def max_upload_bytes():
    return settings.DOCUMENT_MAX_UPLOAD_MB * 1024 * 1024


def clean_name(name):
    """The user's file name without any folder part or control characters."""
    name = os.path.basename(str(name).replace('\\', '/'))
    name = re.sub(r'[\x00-\x1f\x7f]', '', name).strip()
    return name[-255:] or 'file'


def download_name(version):
    """A file name that is safe inside a Content-Disposition header."""
    stem = os.path.splitext(version.original_name)[0]
    stem = re.sub(r'[^A-Za-z0-9._ -]+', '_', stem).strip(' ._')[:120]
    return f'{stem or version.document.number}.{version.extension}'


def _is_text(data):
    if b'\x00' in data:
        return False
    for encoding in ('utf-8', 'cp1252'):
        try:
            data.decode(encoding)
            return True
        except UnicodeDecodeError:
            continue
    return False


def _is_office_zip(upload, extension):
    """A .docx or .xlsx is a zip archive with a known folder inside."""
    try:
        upload.seek(0)
        with zipfile.ZipFile(upload) as archive:
            names = archive.namelist()
    except (zipfile.BadZipFile, OSError, ValueError):
        return False
    return '[Content_Types].xml' in names and any(n.startswith(ZIP_FOLDER[extension]) for n in names)


def _content_matches(upload, extension):
    """Whether the first bytes of the file are what its extension promises."""
    upload.seek(0)
    head = upload.read(16)
    if extension == 'pdf':
        return head.startswith(b'%PDF-')
    if extension == 'png':
        return head.startswith(b'\x89PNG\r\n\x1a\n')
    if extension in ('jpg', 'jpeg'):
        return head.startswith(b'\xff\xd8\xff')
    if extension == 'webp':
        return head[:4] == b'RIFF' and head[8:12] == b'WEBP'
    if extension in ('doc', 'xls'):
        return head.startswith(OLE_HEADER)
    if extension in ZIP_FOLDER:
        return head.startswith(b'PK\x03\x04') and _is_office_zip(upload, extension)
    upload.seek(0)
    return _is_text(upload.read())


def validate_upload(upload):
    """Check size, extension and content. Returns the facts stored with the version."""
    limit = settings.DOCUMENT_MAX_UPLOAD_MB
    if upload.size > max_upload_bytes():
        raise ValidationError({'file': [f'The file is too large. The limit is {limit} MB.']})
    if upload.size == 0:
        raise ValidationError({'file': ['The file is empty.']})

    name = clean_name(upload.name)
    extension = os.path.splitext(name)[1].lstrip('.').lower()
    if extension not in CONTENT_TYPES:
        raise ValidationError({'file': [
            'This type of file is not allowed. Allowed types: ' + ', '.join(ALLOWED_EXTENSIONS) + '.']})
    if not _content_matches(upload, extension):
        raise ValidationError({'file': [f'The content of this file is not a real .{extension} file.']})

    digest = hashlib.sha256()
    upload.seek(0)
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    return {
        'original_name': name, 'extension': extension, 'size_bytes': upload.size,
        'content_type': CONTENT_TYPES[extension], 'sha256': digest.hexdigest(),
    }


@transaction.atomic
def add_version(document, upload, user, note=''):
    """Store a file as the next version of a document. Earlier versions are kept."""
    facts = validate_upload(upload)
    document = Document.objects.select_for_update().get(pk=document.pk)
    version = DocumentVersion.objects.create(
        document=document, version=document.current_version + 1, file=upload,
        note=str(note or '').strip()[:255], uploaded_by=user, **facts)
    document.current_version = version.version
    document.save(update_fields=['current_version'])
    return version
