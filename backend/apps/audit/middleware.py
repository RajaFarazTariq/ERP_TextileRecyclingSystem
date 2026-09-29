# audit/middleware.py
"""
Audit middleware + AuditedModelMixin for DRF ViewSets.

─────────────────────────────────────────────
HOW TO USE
─────────────────────────────────────────────
1. Add to MIDDLEWARE in settings.py (AFTER AuthenticationMiddleware):
       'apps.audit.middleware.AuditMiddleware',

2. For ViewSets you want audited, inherit AuditedModelMixin:
       from apps.audit.middleware import AuditedModelMixin

       class SalesOrderViewSet(AuditedModelMixin, ModelViewSet):
           ...

   The mixin auto-logs CREATE, UPDATE, DELETE on every write.

3. For custom views, import log_action:
       from apps.audit.models import log_action, AuditLog
       log_action(request.user, AuditLog.ACTION_EXPORT, report_obj, request=request)
"""

import json
from django.db import transaction
from django.utils.deprecation import MiddlewareMixin
from rest_framework.viewsets import ModelViewSet

from .models import AuditLog, log_action


# ─────────────────────────────────────────────────────────────────────────────
# Thread-local storage to pass request into model signals if needed
# ─────────────────────────────────────────────────────────────────────────────
import threading
_request_local = threading.local()

def get_current_request():
    return getattr(_request_local, 'request', None)


class AuditMiddleware(MiddlewareMixin):
    """Stores the current request in thread-local so it's accessible everywhere."""

    def process_request(self, request):
        _request_local.request = request

    def process_response(self, request, response):
        _request_local.request = None
        return response


# ─────────────────────────────────────────────────────────────────────────────
# DRF ViewSet mixin — auto-audit CREATE, UPDATE, DELETE
# ─────────────────────────────────────────────────────────────────────────────

class AuditedModelMixin:
    """
    Mixin for DRF ModelViewSet.
    Automatically writes AuditLog entries for:
    - create  → ACTION_CREATE
    - update  → ACTION_UPDATE  (captures field-level diffs)
    - destroy → ACTION_DELETE  (soft delete)
    """

    def _get_instance_dict(self, instance):
        """Convert model instance to a flat dict of field values."""
        result = {}
        for field in instance._meta.get_fields():
            if hasattr(field, 'attname'):
                val = getattr(instance, field.attname, None)
                # Convert non-serializable types
                if hasattr(val, 'isoformat'):
                    val = val.isoformat()
                elif hasattr(val, '__float__'):
                    val = float(val)
                result[field.attname] = val
        return result

    def _diff(self, old_dict, new_dict):
        """Return only the fields that changed."""
        changes = {}
        for key in new_dict:
            old_val = old_dict.get(key)
            new_val = new_dict.get(key)
            if str(old_val) != str(new_val):
                changes[key] = {'old': old_val, 'new': new_val}
        return changes

    def _log(self, action, instance, changes=None):
        log_action(
            user=self.request.user,
            action=action,
            instance=instance,
            changes=changes or {},
            request=self.request,
            extra_repr=str(instance)[:255],
        )

    def snapshot(self, instance):
        """Field values before a change; pass the result to log_change()."""
        return self._get_instance_dict(instance)

    def log_change(self, instance, before):
        """
        Log an UPDATE for changes made outside serializer.save(), e.g. in
        custom actions (confirm, complete, start, ...) or to related records.
        """
        changes = self._diff(before, self._get_instance_dict(instance))
        if changes:
            self._log(AuditLog.ACTION_UPDATE, instance, changes)

    def perform_create(self, serializer, **save_kwargs):
        with transaction.atomic():
            instance = serializer.save(**save_kwargs)
            self._log(AuditLog.ACTION_CREATE, instance)
        return instance

    def perform_update(self, serializer, **save_kwargs):
        with transaction.atomic():
            old_dict = self._get_instance_dict(serializer.instance)
            instance = serializer.save(**save_kwargs)
            self._log(AuditLog.ACTION_UPDATE, instance,
                      self._diff(old_dict, self._get_instance_dict(instance)))
        return instance

    def perform_destroy(self, instance):
        """Soft-delete if the model supports it, else hard delete. Logged only if it succeeds."""
        with transaction.atomic():
            if hasattr(instance, 'is_deleted'):
                self._log(AuditLog.ACTION_DELETE, instance, {'is_deleted': {'old': False, 'new': True}})
            else:
                self._log(AuditLog.ACTION_DELETE, instance)
            instance.delete()   # a blocked delete rolls the log entry back
