from django.contrib import admin

from .models import (
    BillOfMaterials, BomLine, MaterialUse, OrderStep, ProcessStage, ProductionOrder, Routing, RoutingStep,
)


@admin.register(ProcessStage)
class ProcessStageAdmin(admin.ModelAdmin):
    list_display = ['name', 'sequence', 'module', 'is_active']


class RoutingStepInline(admin.TabularInline):
    model = RoutingStep
    extra = 0


@admin.register(Routing)
class RoutingAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']
    inlines = [RoutingStepInline]


class BomLineInline(admin.TabularInline):
    model = BomLine
    extra = 0


@admin.register(BillOfMaterials)
class BillOfMaterialsAdmin(admin.ModelAdmin):
    list_display = ['name', 'product_name', 'is_active']
    inlines = [BomLineInline]


class OrderStepInline(admin.TabularInline):
    model = OrderStep
    extra = 0


class MaterialUseInline(admin.TabularInline):
    model = MaterialUse
    extra = 0


@admin.register(ProductionOrder)
class ProductionOrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'product_name', 'status', 'priority', 'planned_start', 'planned_end']
    list_filter = ['status', 'priority']
    search_fields = ['number', 'product_name']
    inlines = [OrderStepInline, MaterialUseInline]
