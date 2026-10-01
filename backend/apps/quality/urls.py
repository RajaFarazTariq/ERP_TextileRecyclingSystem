from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CorrectiveActionViewSet, InspectionViewSet, QualitySummaryView, StandardViewSet

router = DefaultRouter()
router.register(r'standards', StandardViewSet, basename='quality-standard')
router.register(r'inspections', InspectionViewSet, basename='inspection')
router.register(r'actions', CorrectiveActionViewSet, basename='corrective-action')

urlpatterns = [
    path('summary/', QualitySummaryView.as_view(), name='quality-summary'),
    path('', include(router.urls)),
]
