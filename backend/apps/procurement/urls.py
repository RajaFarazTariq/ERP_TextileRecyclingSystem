from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    OpenLineViewSet, PriceComparisonView, ProcurementSummaryView, PurchaseOrderViewSet, PurchaseReturnViewSet,
    QuotationViewSet, RequisitionViewSet, SupplierInvoiceViewSet, SupplierPaymentViewSet, SupplierPerformanceView,
)

router = DefaultRouter()
router.register(r'requisitions', RequisitionViewSet, basename='requisition')
router.register(r'orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'open-lines', OpenLineViewSet, basename='open-line')
router.register(r'returns', PurchaseReturnViewSet, basename='purchase-return')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'invoices', SupplierInvoiceViewSet, basename='supplier-invoice')
router.register(r'payments', SupplierPaymentViewSet, basename='supplier-payment')

urlpatterns = [
    path('summary/', ProcurementSummaryView.as_view(), name='procurement-summary'),
    path('supplier-performance/', SupplierPerformanceView.as_view(), name='supplier-performance'),
    path('price-comparison/', PriceComparisonView.as_view(), name='price-comparison'),
    path('', include(router.urls)),
]
