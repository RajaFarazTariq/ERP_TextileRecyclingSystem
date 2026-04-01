from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChemicalStockViewSet, TankViewSet,
    ChemicalIssuanceViewSet, DecolorizationSessionViewSet
)

router = DefaultRouter()
router.register(r'chemicals', ChemicalStockViewSet)
router.register(r'tanks', TankViewSet)
router.register(r'issuances', ChemicalIssuanceViewSet)
router.register(r'sessions', DecolorizationSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]