from datetime import date

from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.core.filters import filter_by_date_params
from apps.core.permissions import HasPage
from . import services
from .models import Account, Expense, FinancialPeriod, JournalEntry, TaxRate
from .serializers import (
    AccountSerializer, ExpenseSerializer, FinancialPeriodSerializer, JournalEntrySerializer, TaxRateSerializer,
)

# Finance belongs to whoever has the Finance page (admins only, unless an admin gives it to someone)
ADMIN = [IsAuthenticated, HasPage('finance')]


def _day(params, name, default):
    try:
        return date.fromisoformat(params[name]) if params.get(name) else default
    except ValueError:
        raise serializers.ValidationError({name: ['Enter a date as YYYY-MM-DD.']})


def _range(params):
    """(start, end) from ?start=&end=; by default the current year to date."""
    today = timezone.localdate()
    start, end = _day(params, 'start', today.replace(month=1, day=1)), _day(params, 'end', today)
    if end < start:
        raise serializers.ValidationError({'end': ["Can't be before the start date."]})
    return start, end


class AccountViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = ADMIN

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['totals'] = services._totals()
        return context

    def perform_destroy(self, instance):
        if instance.system_key:
            raise serializers.ValidationError('Automatic postings use this account, so it can\'t be deleted.')
        if instance.lines.exists():
            raise serializers.ValidationError('This account has entries. Mark it as not in use instead.')
        super().perform_destroy(instance)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """Every line on this account with a running balance (?start=&end=)."""
        params = request.query_params
        return Response(services.ledger(self.get_object(), _day(params, 'start', None), _day(params, 'end', None)))


class PeriodViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = FinancialPeriod.objects.select_related('closed_by')
    serializer_class = FinancialPeriodSerializer
    permission_classes = ADMIN

    def perform_destroy(self, instance):
        if instance.is_closed:
            raise serializers.ValidationError('Reopen the period before deleting it.')
        super().perform_destroy(instance)

    def _set(self, request, closed):
        period = self.get_object()
        if period.is_closed == closed:
            raise serializers.ValidationError(f"This period is already {'closed' if closed else 'open'}.")
        before = self.snapshot(period)
        if closed:
            services.sync_operations(request.user)     # take in everything up to now before locking
        period.is_closed = closed
        period.closed_by = request.user if closed else None
        period.closed_at = timezone.now() if closed else None
        period.save()
        self.log_change(period, before)
        return Response(self.get_serializer(period).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        return self._set(request, True)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        return self._set(request, False)


class TaxRateViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = TaxRate.objects.all()
    serializer_class = TaxRateSerializer
    permission_classes = ADMIN


class JournalEntryViewSet(AuditedModelMixin, mixins.CreateModelMixin, mixins.ListModelMixin,
                          mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Entries are never edited or deleted: a wrong one is reversed, which keeps the trail."""
    queryset = JournalEntry.objects.select_related('created_by', 'reverses', 'reversed_by').prefetch_related('lines__account')
    serializer_class = JournalEntrySerializer
    permission_classes = ADMIN

    def get_queryset(self):
        qs = filter_by_date_params(super().get_queryset(), self.request.query_params, 'date')
        if source := self.request.query_params.get('source'):
            qs = qs.filter(source=source)
        if account := self.request.query_params.get('account'):
            qs = qs.filter(lines__account_id=account).distinct()
        return qs

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        reversal = services.reverse(self.get_object(), request.user, _day(request.data, 'date', None))
        return Response(self.get_serializer(reversal).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['post'])
    def sync(self, request):
        """Post, correct or remove the entries that come from sales, purchasing and expenses."""
        return Response(services.sync_operations(request.user))


class ExpenseViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('account', 'paid_from', 'created_by')
    serializer_class = ExpenseSerializer
    permission_classes = ADMIN

    def get_queryset(self):
        return filter_by_date_params(super().get_queryset(), self.request.query_params, 'date')

    # The expense and its journal entry are saved together
    @transaction.atomic
    def perform_create(self, serializer):
        expense = super().perform_create(serializer, created_by=self.request.user)
        services.sync_operations(self.request.user)
        return expense

    @transaction.atomic
    def perform_update(self, serializer):
        expense = super().perform_update(serializer)
        services.sync_operations(self.request.user)
        return expense

    @transaction.atomic
    def perform_destroy(self, instance):
        services.check_open(instance.date)
        super().perform_destroy(instance)
        services.sync_operations(self.request.user)


class ReportView(APIView):
    """Base for the statements: brings the books up to date, then builds the report."""
    permission_classes = ADMIN

    def build(self, request):
        raise NotImplementedError

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        services.sync_operations(request.user)
        return Response(self.build(request))


class TrialBalanceView(ReportView):
    def build(self, request):
        return services.trial_balance(_day(request.query_params, 'as_of', timezone.localdate()))


class ProfitAndLossView(ReportView):
    def build(self, request):
        return services.profit_and_loss(*_range(request.query_params))


class BalanceSheetView(ReportView):
    def build(self, request):
        return services.balance_sheet(_day(request.query_params, 'as_of', timezone.localdate()))


class CashFlowView(ReportView):
    def build(self, request):
        return services.cash_flow(*_range(request.query_params))


class BalancesView(ReportView):
    def build(self, request):
        return services.balances()


class CostingView(ReportView):
    def build(self, request):
        return services.production_cost(*_range(request.query_params))


class FinanceSummaryView(ReportView):
    def build(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        month = services.profit_and_loss(month_start, today)
        year = services.profit_and_loss(today.replace(month=1, day=1), today)
        owed = services.balances()
        totals = services._totals()
        cash = [{'account': a.pk, 'name': a.name, 'balance': f'{services.balance_of(a, *totals.get(a.pk, (0, 0))):.2f}'}
                for a in Account.objects.filter(is_cash=True, is_active=True)]
        trend = []
        for back in range(5, -1, -1):
            first = (month_start.replace(day=15) - timezone.timedelta(days=30 * back)).replace(day=1)
            last = (first.replace(day=28) + timezone.timedelta(days=4)).replace(day=1) - timezone.timedelta(days=1)
            figures = services.profit_and_loss(first, min(last, today))
            trend.append({'month': first.strftime('%Y-%m'), 'income': figures['total_income'],
                          'expenses': figures['total_expenses'], 'profit': figures['net_profit']})
        return {
            'cash': cash, 'cash_total': f"{sum((services.money(c['balance']) for c in cash), services.ZERO):.2f}",
            'receivable': owed['total_receivable'], 'payable': owed['total_payable'],
            'income_month': month['total_income'], 'expenses_month': month['total_expenses'], 'profit_month': month['net_profit'],
            'income_year': year['total_income'], 'expenses_year': year['total_expenses'], 'profit_year': year['net_profit'],
            'trend': trend,
            'top_expenses': sorted(month['expenses'], key=lambda r: -services.money(r['amount']))[:6],
            'open_period': not services.closed_period(today),
        }

