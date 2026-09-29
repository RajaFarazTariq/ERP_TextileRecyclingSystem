from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Module APIs. Served at /api/ (what the current frontend uses) and at the
# versioned /api/v1/ prefix for new clients.
api_patterns = [
    path('users/', include('apps.users.urls')),
    path('warehouse/', include('apps.warehouse.urls')),
    path('sorting/', include('apps.sorting.urls')),
    path('decolorization/', include('apps.decolorization.urls')),
    path('drying/', include('apps.drying.urls')),
    path('sales/', include('apps.sales.urls')),
    path('reports/', include('apps.reports.urls')),
    path('', include('apps.audit.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='api-schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='api-schema'), name='api-docs'),
    path('api/v1/', include((api_patterns, 'v1'))),
    path('api/', include(api_patterns)),
]
