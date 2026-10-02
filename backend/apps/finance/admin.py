from django.contrib import admin

from .models import Account, Expense, FinancialPeriod, JournalEntry, JournalLine, TaxRate


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 0


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ['number', 'date', 'memo', 'source']
    list_filter = ['source']
    inlines = [JournalLineInline]


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'type', 'is_cash', 'is_active']
    list_filter = ['type']


admin.site.register([Expense, FinancialPeriod, TaxRate])
