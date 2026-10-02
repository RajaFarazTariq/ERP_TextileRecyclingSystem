from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet, DispatchTrackingViewSet, PaymentViewSet, ProductViewSet, SalesInvoiceViewSet,
    SalesOrderViewSet, SalesPerformanceView, SalesQuotationViewSet, SalesReturnViewSet,
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'orders', SalesOrderViewSet)
router.register(r'dispatch', DispatchTrackingViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'products', ProductViewSet)
router.register(r'quotations', SalesQuotationViewSet)
router.register(r'invoices', SalesInvoiceViewSet)
router.register(r'returns', SalesReturnViewSet)

urlpatterns = [
    path('performance/', SalesPerformanceView.as_view(), name='sales-performance'),
    path('', include(router.urls)),
]