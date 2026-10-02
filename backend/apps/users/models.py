from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class CustomUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # Superusers get the admin role; regular users must be given a role explicitly.
        extra_fields.setdefault('role', 'admin')
        return super().create_superuser(username, email, password, **extra_fields)


class CustomUser(AbstractUser):
    # The key of the user's role (apps.access.Role). The built-in keys are listed
    # for reference; admins can add more roles, so the field takes any key.
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('warehouse_supervisor', 'Warehouse Supervisor'),
        ('sorting_supervisor', 'Sorting Supervisor'),
        ('decolorization_supervisor', 'Decolorization Supervisor'),
        ('drying_supervisor', 'Drying Supervisor'),
    ]
    role = models.CharField(max_length=50)

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"