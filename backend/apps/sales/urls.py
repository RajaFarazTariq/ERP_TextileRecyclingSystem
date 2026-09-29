from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalesOrderViewSet, DispatchTrackingViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'orders', SalesOrderViewSet)
router.register(r'dispatch', DispatchTrackingViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]