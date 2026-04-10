# drying/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DryerViewSet,
    DryingSessionViewSet,
    fabric_for_drying,
    decolor_sessions_for_drying,
)

router = DefaultRouter()
router.register(r'dryers',   DryerViewSet,         basename='dryers')
router.register(r'sessions', DryingSessionViewSet, basename='drying-sessions')

urlpatterns = [
    path('', include(router.urls)),
    path('fabric-ready/',         fabric_for_drying,            name='drying-fabric-ready'),
    path('decolor-sessions-done/', decolor_sessions_for_drying, name='drying-decolor-done'),
]
