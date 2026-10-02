from django.contrib import admin
from .models import (
    ChemicalIssuance, ChemicalLot, ChemicalStock, DecolorizationSession, Recipe, RecipeLine, RecipeVersion, Tank,
)


@admin.register(ChemicalStock)
class ChemicalStockAdmin(admin.ModelAdmin):
    list_display = [
        'chemical_name', 'total_stock',
        'remaining_stock', 'unit_of_measure', 'last_updated'
    ]
    search_fields = ['chemical_name']


@admin.register(Tank)
class TankAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'batch_id', 'capacity',
        'tank_status', 'supervisor', 'created_at'
    ]
    list_filter = ['tank_status']
    search_fields = ['name', 'batch_id']


@admin.register(ChemicalIssuance)
class ChemicalIssuanceAdmin(admin.ModelAdmin):
    list_display = [
        'chemical', 'tank', 'issued_by',
        'quantity', 'issued_at'
    ]


@admin.register(DecolorizationSession)
class DecolorizationSessionAdmin(admin.ModelAdmin):
    list_display = [
        'tank', 'fabric', 'supervisor',
        'input_quantity', 'status', 'start_date'
    ]
    list_filter = ['status']


@admin.register(ChemicalLot)
class ChemicalLotAdmin(admin.ModelAdmin):
    list_display = ['chemical', 'lot_number', 'quantity', 'unit_cost', 'received_on', 'expiry_date']
    search_fields = ['lot_number', 'chemical__chemical_name']


class RecipeLineInline(admin.TabularInline):
    model = RecipeLine
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ['name', 'material_type', 'is_active']
    search_fields = ['name']


@admin.register(RecipeVersion)
class RecipeVersionAdmin(admin.ModelAdmin):
    list_display = ['recipe', 'version', 'temperature_c', 'duration_minutes', 'created_by', 'created_at']
    inlines = [RecipeLineInline]
