# audit/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AuditLogViewSet, audit_summary

router = DefaultRouter()
router.register(r'audit/logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    # Must come before the router, whose detail route would otherwise match "summary"
    path('audit/logs/summary/', audit_summary, name='audit-summary'),
    path('', include(router.urls)),
]
