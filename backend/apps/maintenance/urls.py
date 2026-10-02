from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    MachineViewSet, MaintenanceSummaryView, PartUseViewSet, PerformanceView, ScheduleViewSet, SparePartViewSet,
    WorkOrderViewSet,
)

router = DefaultRouter()
router.register(r'machines', MachineViewSet, basename='machine')
router.register(r'schedules', ScheduleViewSet, basename='maintenance-schedule')
router.register(r'work-orders', WorkOrderViewSet, basename='work-order')
router.register(r'parts', SparePartViewSet, basename='spare-part')
router.register(r'part-uses', PartUseViewSet, basename='part-use')

urlpatterns = [
    path('summary/', MaintenanceSummaryView.as_view(), name='maintenance-summary'),
    path('performance/', PerformanceView.as_view(), name='maintenance-performance'),
    path('', include(router.urls)),
]
