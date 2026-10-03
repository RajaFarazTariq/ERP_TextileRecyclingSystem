"""
Which pages each role may open, how far, and per-user exceptions.

A page is one entry of the web app's menu ("sales", "finance", ...). A page is
held at a level: "view" (look only) or "full" (look and change). The level also
decides what the API behind the page allows (see services.py). Admins always
have every page in full, so these tables hold the other roles only.
"""
from django.db import models

from apps.users.models import CustomUser


class Role(models.Model):
    """
    A job in the organisation ("Accountant", "Sorting Supervisor"). A user has
    one role. The built-in roles can't be renamed or deleted; admins can add
    their own. `key` is what is stored on the user.
    """
    key = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=255, blank=True, default='')
    is_system = models.BooleanField(default=False, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_system', 'id']

    def __str__(self):
        return self.name


class RoleDuty(models.Model):
    """This role carries this duty (see services.DUTIES), e.g. approving purchases."""
    role = models.CharField(max_length=50)
    duty = models.CharField(max_length=50)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['role', 'duty'], name='unique_role_duty')]
        ordering = ['role', 'duty']

    def __str__(self):
        return f'{self.role}: {self.duty}'


class RolePage(models.Model):
    """This role has this page, to view or in full."""
    LEVEL_CHOICES = [('view', 'View only'), ('full', 'Full')]

    role = models.CharField(max_length=50)
    page = models.CharField(max_length=50)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='full')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['role', 'page'], name='unique_role_page')]
        ordering = ['role', 'page']

    def __str__(self):
        return f'{self.role}: {self.page}'


class UserPageOverride(models.Model):
    """One person's exception to their role: their own level for a page ("none" takes it away)."""
    LEVEL_CHOICES = [('none', 'No access'), ('view', 'View only'), ('full', 'Full')]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='page_overrides')
    page = models.CharField(max_length=50)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='full')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'page'], name='unique_user_page_override')]
        ordering = ['user_id', 'page']

    def __str__(self):
        return f'{self.user}: {self.page} = {self.level}'
