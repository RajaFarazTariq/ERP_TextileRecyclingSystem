from django.contrib import admin

from .models import NotificationRule


@admin.register(NotificationRule)
class NotificationRuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'key', 'is_enabled', 'threshold', 'send_email', 'escalate_after_days']
    list_filter = ['is_enabled', 'send_email']
    readonly_fields = ['key']
