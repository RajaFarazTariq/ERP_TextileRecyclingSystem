from django.contrib import admin

from .models import StockMovement


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'fabric', 'movement_type', 'quantity', 'source_type', 'source_id', 'created_by']
    list_filter = ['movement_type']
    search_fields = ['note', 'fabric__material_type']

    # The ledger is append-only; corrections go through the adjust endpoint
    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
