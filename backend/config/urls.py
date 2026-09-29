from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/warehouse/', include('apps.warehouse.urls')),
    path('api/sorting/', include('apps.sorting.urls')),
    path('api/decolorization/', include('apps.decolorization.urls')),
    path('api/drying/', include('apps.drying.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/', include('apps.audit.urls')),
]
