from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FabricStockViewSet, SortingSessionViewSet

router = DefaultRouter()
router.register(r'fabric-stock', FabricStockViewSet)
router.register(r'sessions', SortingSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]