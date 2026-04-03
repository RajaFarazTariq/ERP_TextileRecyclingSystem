from audit.views import AuditLogViewSet, audit_summary

router.register(r'audit/logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    ...
   path('api/audit/logs/summary/', audit_summary, name='audit-summary'),
   path('api/', include(router.urls)),
    ...
]