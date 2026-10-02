"""
Which pages each role may open, and per-user exceptions.

A page is one entry of the web app's menu ("sales", "finance", ...). Having a
page also gives access to the API behind it (see services.py). Admins always
have every page, so these tables hold the other roles only.
"""
from django.db import models

from apps.users.models import CustomUser


class RolePage(models.Model):
    """This role may open this page."""
    role = models.CharField(max_length=50)
    page = models.CharField(max_length=50)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['role', 'page'], name='unique_role_page')]
        ordering = ['role', 'page']

    def __str__(self):
        return f'{self.role}: {self.page}'


class UserPageOverride(models.Model):
    """One person's exception to their role: a page given to them, or taken away."""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='page_overrides')
    page = models.CharField(max_length=50)
    allowed = models.BooleanField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'page'], name='unique_user_page_override')]
        ordering = ['user_id', 'page']

    def __str__(self):
        return f"{self.user}: {'+' if self.allowed else '-'}{self.page}"
