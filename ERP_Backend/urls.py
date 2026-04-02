from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from audit.views import AuditLogViewSet, audit_summary

router = DefaultRouter()
router.register(r'audit/logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/warehouse/', include('warehouse.urls')),
    path('api/sorting/', include('sorting.urls')),
    path('api/decolorization/', include('decolorization.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/', include(router.urls)),
    path('api/audit/logs/summary/', audit_summary, name='audit-summary'),
]