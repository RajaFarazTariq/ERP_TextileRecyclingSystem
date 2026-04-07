from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VendorViewSet, FactoryUnitViewSet, StockViewSet

router = DefaultRouter()
router.register(r'vendors', VendorViewSet)
router.register(r'units', FactoryUnitViewSet)
router.register(r'stock', StockViewSet)

urlpatterns = [
    path('', include(router.urls)),
]