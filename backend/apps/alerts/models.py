"""
Alerts: the rules behind the notification bell.

Nothing is stored per notification. Each rule looks at the live records of
another module (see `rules.py`) and lists what needs attention right now, so
an item goes away by itself once the problem is solved. A rule row only holds
the settings an admin can change: on or off, its threshold, which roles
receive it, whether it goes into the e-mail digest, and when it escalates.
"""
from django.db import models


class NotificationRule(models.Model):
    key = models.CharField(max_length=50, unique=True, editable=False)
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True, default='')
    is_enabled = models.BooleanField(default=True)
    # What the number means depends on the rule (days, percent, kg); see threshold_label
    threshold = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    threshold_label = models.CharField(max_length=120, blank=True, default='')
    # Role keys that receive the rule's items. Admins always do.
    roles = models.JSONField(default=list, blank=True)
    send_email = models.BooleanField(default=False, help_text='Include in the e-mail digest')
    escalate_after_days = models.PositiveIntegerField(
        null=True, blank=True, help_text='Days an item may stay open before it is marked as escalated')
    sort_order = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title
