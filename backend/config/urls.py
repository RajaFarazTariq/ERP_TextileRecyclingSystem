from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.health import health

# Module APIs. Served at the versioned /api/v1/ prefix (used by the web app)
# and, for older clients, at /api/.
api_patterns = [
    path('users/', include('apps.users.urls')),
    path('warehouse/', include('apps.warehouse.urls')),
    path('sorting/', include('apps.sorting.urls')),
    path('decolorization/', include('apps.decolorization.urls')),
    path('drying/', include('apps.drying.urls')),
    path('sales/', include('apps.sales.urls')),
    path('inventory/', include('apps.inventory.urls')),
    path('procurement/', include('apps.procurement.urls')),
    path('quality/', include('apps.quality.urls')),
    path('production/', include('apps.production.urls')),
    path('finance/', include('apps.finance.urls')),
    path('maintenance/', include('apps.maintenance.urls')),
    path('sustainability/', include('apps.sustainability.urls')),
    path('workforce/', include('apps.workforce.urls')),
    path('documents/', include('apps.documents.urls')),
    path('search/', include('apps.search.urls')),
    path('alerts/', include('apps.alerts.urls')),
    path('reports/', include('apps.reports.urls')),
    path('', include('apps.audit.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health, name='health'),
    path('api/schema/', SpectacularAPIView.as_view(), name='api-schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='api-schema'), name='api-docs'),
    path('api/v1/', include((api_patterns, 'v1'))),
    path('api/', include(api_patterns)),
]
