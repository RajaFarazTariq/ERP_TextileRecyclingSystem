from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SustainabilityReportView, SustainabilitySummaryView, TargetViewSet, UtilityReadingViewSet,
    WasteCategoryViewSet, WasteRecordViewSet,
)

router = DefaultRouter()
router.register(r'waste-categories', WasteCategoryViewSet, basename='waste-category')
router.register(r'waste-records', WasteRecordViewSet, basename='waste-record')
router.register(r'utility-readings', UtilityReadingViewSet, basename='utility-reading')
router.register(r'targets', TargetViewSet, basename='sustainability-target')

urlpatterns = [
    path('summary/', SustainabilitySummaryView.as_view(), name='sustainability-summary'),
    path('report/', SustainabilityReportView.as_view(), name='sustainability-report'),
    path('', include(router.urls)),
]
