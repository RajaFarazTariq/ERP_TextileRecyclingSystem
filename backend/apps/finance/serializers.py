from rest_framework import serializers

from . import services
from .models import Account, Expense, FinancialPeriod, JournalEntry, JournalLine, TaxRate


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()
    is_system = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'type', 'is_cash', 'description', 'is_active', 'balance', 'is_system']

    def get_balance(self, obj) -> str:
        debit, credit = self.context.get('totals', {}).get(obj.pk, (services.ZERO, services.ZERO))
        return f'{services.balance_of(obj, debit, credit):.2f}'

    def get_is_system(self, obj) -> bool:
        return obj.system_key is not None

    def validate(self, data):
        account = self.instance
        kind = data.get('type', getattr(account, 'type', None))
        if data.get('is_cash', getattr(account, 'is_cash', False)) and kind != Account.ASSET:
            raise serializers.ValidationError({'is_cash': ['Only an asset account can be a cash or bank account.']})
        if account is not None and 'type' in data and data['type'] != account.type and account.lines.exists():
            raise serializers.ValidationError({'type': ["The type can't change once the account has entries."]})
        if account is not None and account.system_key and data.get('is_active') is False:
            raise serializers.ValidationError({'is_active': ['Automatic postings use this account, so it stays active.']})
        return data


class FinancialPeriodSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, default=None)

    class Meta:
        model = FinancialPeriod
        fields = '__all__'
        read_only_fields = ['is_closed', 'closed_by', 'closed_at']

    def validate(self, data):
        period = self.instance
        if period is not None and period.is_closed:
            raise serializers.ValidationError('Reopen the period before changing it.')
        start = data.get('start_date', getattr(period, 'start_date', None))
        end = data.get('end_date', getattr(period, 'end_date', None))
        if start and end:
            if end < start:
                raise serializers.ValidationError({'end_date': ["Can't be before the start date."]})
            overlap = FinancialPeriod.objects.filter(start_date__lte=end, end_date__gte=start)
            if period is not None:
                overlap = overlap.exclude(pk=period.pk)
            if overlap.exists():
                raise serializers.ValidationError({'start_date': [f'These dates overlap {overlap.first().name}.']})
        return data


class TaxRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxRate
        fields = '__all__'

    def validate_rate(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError('Must be between 0 and 100.')
        return value


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = JournalLine
        fields = ['id', 'account', 'account_code', 'account_name', 'debit', 'credit', 'description']


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)
    total = serializers.SerializerMethodField()
    reversed_by_number = serializers.SerializerMethodField()
    reverses_number = serializers.CharField(source='reverses.number', read_only=True, default=None)

    class Meta:
        model = JournalEntry
        fields = ['id', 'number', 'date', 'memo', 'source', 'source_id', 'reference', 'reverses', 'reverses_number',
                  'reversed_by_number', 'created_by', 'created_by_name', 'created_at', 'lines', 'total']
        read_only_fields = ['source', 'source_id', 'reverses', 'created_by']

    def get_total(self, obj) -> str:
        return f'{sum((line.debit for line in obj.lines.all()), services.ZERO):.2f}'

    def get_reversed_by_number(self, obj) -> str | None:
        reversal = getattr(obj, 'reversed_by', None)
        return reversal.number if reversal else None

    def validate_lines(self, lines):
        for line in lines:
            if not line['account'].is_active:
                raise serializers.ValidationError(f"{line['account']} is not in use.")
        services.check_lines(lines)
        return lines

    def create(self, validated):
        lines = validated.pop('lines')
        return services.post(validated['date'], validated['memo'], lines, reference=validated.get('reference', ''),
                             user=validated.get('created_by'))


class ExpenseSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    paid_from_name = serializers.CharField(source='paid_from.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['created_by']

    def validate(self, data):
        services.check_expense(data, self.instance)
        return data
