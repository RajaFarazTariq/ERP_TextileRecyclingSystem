from django.contrib import admin

from .models import CorrectiveAction, Inspection, InspectionResult, QualityStandard, StandardCheck


class StandardCheckInline(admin.TabularInline):
    model = StandardCheck
    extra = 0


@admin.register(QualityStandard)
class QualityStandardAdmin(admin.ModelAdmin):
    list_display = ['name', 'stage', 'material_type', 'is_active']
    list_filter = ['stage', 'is_active']
    inlines = [StandardCheckInline]


class InspectionResultInline(admin.TabularInline):
    model = InspectionResult
    extra = 0


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = ['number', 'stage', 'result', 'inspector', 'inspected_on', 'released_at']
    list_filter = ['stage', 'result']
    search_fields = ['number']
    inlines = [InspectionResultInline]


@admin.register(CorrectiveAction)
class CorrectiveActionAdmin(admin.ModelAdmin):
    list_display = ['inspection', 'kind', 'owner', 'due_date', 'status']
    list_filter = ['status', 'kind']
