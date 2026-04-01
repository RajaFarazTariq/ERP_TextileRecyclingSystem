from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/warehouse/', include('warehouse.urls')),
    path('api/sorting/', include('sorting.urls')),
    path('api/decolorization/', include('decolorization.urls')),
    path('api/sales/', include('sales.urls')),
]