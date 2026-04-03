# decolorization/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ChemicalStockViewSet,
    TankViewSet,
    ChemicalIssuanceViewSet,
    DecolorizationSessionViewSet,
    fabric_stock_for_decolor,
)

router = DefaultRouter()
router.register(r'chemicals',  ChemicalStockViewSet)
router.register(r'tanks',      TankViewSet)
router.register(r'issuances',  ChemicalIssuanceViewSet)
router.register(r'sessions',   DecolorizationSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),

    # Fabric stock dropdown — uses decolorization permission so
    # decolor_user doesn't need sorting module access
    path('fabric-stock/', fabric_stock_for_decolor, name='decolor-fabric-stock'),
]