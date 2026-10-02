from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ApprovalsView, NotificationRuleViewSet, NotificationsView

router = DefaultRouter()
router.register(r'rules', NotificationRuleViewSet, basename='notification-rule')

urlpatterns = [
    path('notifications/', NotificationsView.as_view(), name='alert-notifications'),
    path('approvals/', ApprovalsView.as_view(), name='alert-approvals'),
    path('', include(router.urls)),
]
