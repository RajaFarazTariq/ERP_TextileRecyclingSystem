from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BomViewSet, MaterialUseViewSet, OrderStepViewSet, ProductionOrderViewSet, ProductionSummaryView,
    RequirementsView, RoutingViewSet, StageViewSet,
)

router = DefaultRouter()
router.register(r'stages', StageViewSet, basename='process-stage')
router.register(r'routings', RoutingViewSet, basename='routing')
router.register(r'boms', BomViewSet, basename='bom')
router.register(r'orders', ProductionOrderViewSet, basename='production-order')
router.register(r'steps', OrderStepViewSet, basename='order-step')
router.register(r'materials', MaterialUseViewSet, basename='material-use')

urlpatterns = [
    path('summary/', ProductionSummaryView.as_view(), name='production-summary'),
    path('requirements/', RequirementsView.as_view(), name='production-requirements'),
    path('', include(router.urls)),
]
