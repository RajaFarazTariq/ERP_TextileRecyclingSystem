from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, DocumentSummaryView, DocumentViewSet, ExpiringView

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='document-category')
router.register(r'documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('summary/', DocumentSummaryView.as_view(), name='documents-summary'),
    path('expiring/', ExpiringView.as_view(), name='documents-expiring'),
    path('', include(router.urls)),
]
