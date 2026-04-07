# audit/models.py
"""
Audit log system.
─────────────────
• AuditLog: records every CREATE / UPDATE / DELETE on any model
• SoftDeleteMixin: mixin for models that should be soft-deleted (is_deleted flag)
  instead of permanently removed from the database.

USAGE
─────
1. Add SoftDeleteMixin to any model you want soft-delete:
       class SalesOrder(SoftDeleteMixin, models.Model): ...

2. AuditLog is written automatically by AuditMiddleware (audit/middleware.py)
   and by the helper function `log_action()`.

3. Run:  python manage.py makemigrations audit && python manage.py migrate
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Soft-delete mixin
# ─────────────────────────────────────────────────────────────────────────────

class SoftDeleteQuerySet(models.QuerySet):
    """Custom QuerySet that filters out soft-deleted records by default."""

    def alive(self):
        return self.filter(is_deleted=False)

    def deleted(self):
        return self.filter(is_deleted=True)

    def delete(self):
        """Soft-delete all records in the queryset."""
        return self.update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        """Permanently delete — use with caution."""
        return super().delete()


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def only_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()


class SoftDeleteMixin(models.Model):
    """
    Inherit this mixin to get soft-delete on any model.
    Default manager returns only non-deleted objects.
    Use Model.objects.with_deleted() to include deleted ones.
    """
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()

    def delete(self, using=None, keep_parents=False):
        """Soft-delete: mark as deleted, do NOT remove from DB."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def hard_delete(self, using=None, keep_parents=False):
        """Permanently delete from database."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])

    class Meta:
        abstract = True


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log model
# ─────────────────────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    ACTION_CREATE = 'CREATE'
    ACTION_UPDATE = 'UPDATE'
    ACTION_DELETE = 'DELETE'
    ACTION_RESTORE = 'RESTORE'
    ACTION_LOGIN  = 'LOGIN'
    ACTION_EXPORT = 'EXPORT'
    ACTION_CHOICES = [
        (ACTION_CREATE,  'Create'),
        (ACTION_UPDATE,  'Update'),
        (ACTION_DELETE,  'Delete (Soft)'),
        (ACTION_RESTORE, 'Restore'),
        (ACTION_LOGIN,   'Login'),
        (ACTION_EXPORT,  'Export'),
    ]

    # Who
    user       = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs'
    )
    username   = models.CharField(max_length=150, blank=True)  # stored denormalized
    user_role  = models.CharField(max_length=80,  blank=True)

    # What
    action     = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)   # e.g. "SalesOrder"
    object_id  = models.CharField(max_length=50, blank=True)   # PK of affected object
    object_repr= models.CharField(max_length=255, blank=True)  # human-readable description

    # Change details
    changes    = models.JSONField(default=dict, blank=True)
    # e.g. {"status": {"old": "Draft", "new": "Confirmed"}}

    # Context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    endpoint   = models.CharField(max_length=300, blank=True)  # request path

    # When
    timestamp  = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes  = [
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.username} {self.action} {self.model_name}#{self.object_id}"


# ─────────────────────────────────────────────────────────────────────────────
# Helper function for manual audit logging
# ─────────────────────────────────────────────────────────────────────────────

def log_action(user, action, instance, changes=None, request=None, extra_repr=''):
    """
    Convenience function to write an audit log entry.

    Usage:
        from audit.models import log_action, AuditLog
        log_action(request.user, AuditLog.ACTION_UPDATE, order,
                   changes={'status': {'old': 'Draft', 'new': 'Confirmed'}},
                   request=request)
    """
    model_name = instance.__class__.__name__
    object_id  = str(instance.pk) if instance.pk else ''
    object_repr = extra_repr or str(instance)[:255]

    ip  = None
    ua  = ''
    url = ''
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip  = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
        ua  = request.META.get('HTTP_USER_AGENT', '')[:300]
        url = request.path[:300]

    AuditLog.objects.create(
        user=user,
        username=user.username if user and user.is_authenticated else 'system',
        user_role=getattr(user, 'role', '') if user and user.is_authenticated else '',
        action=action,
        model_name=model_name,
        object_id=object_id,
        object_repr=object_repr,
        changes=changes or {},
        ip_address=ip,
        user_agent=ua,
        endpoint=url,
    )
