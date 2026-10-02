from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountViewSet, BalanceSheetView, BalancesView, CashFlowView, CostingView, ExpenseViewSet, FinanceSummaryView,
    JournalEntryViewSet, PeriodViewSet, ProfitAndLossView, TaxRateViewSet, TrialBalanceView,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='finance-account')
router.register(r'periods', PeriodViewSet, basename='finance-period')
router.register(r'tax-rates', TaxRateViewSet, basename='finance-tax-rate')
router.register(r'journal', JournalEntryViewSet, basename='finance-journal')
router.register(r'expenses', ExpenseViewSet, basename='finance-expense')

urlpatterns = [
    path('summary/', FinanceSummaryView.as_view(), name='finance-summary'),
    path('trial-balance/', TrialBalanceView.as_view(), name='finance-trial-balance'),
    path('profit-and-loss/', ProfitAndLossView.as_view(), name='finance-profit-and-loss'),
    path('balance-sheet/', BalanceSheetView.as_view(), name='finance-balance-sheet'),
    path('cash-flow/', CashFlowView.as_view(), name='finance-cash-flow'),
    path('balances/', BalancesView.as_view(), name='finance-balances'),
    path('costing/', CostingView.as_view(), name='finance-costing'),
    path('', include(router.urls)),
]
