# core/exceptions.py
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """DRF's handler, plus a readable 409 when a delete is blocked by linked records."""
    if isinstance(exc, ProtectedError):
        linked = sorted({str(obj._meta.verbose_name_plural) for obj in exc.protected_objects})
        return Response(
            {'detail': 'This record cannot be deleted because other records depend on it: '
                       + ', '.join(linked) + '.'},
            status=status.HTTP_409_CONFLICT,
        )
    return exception_handler(exc, context)
