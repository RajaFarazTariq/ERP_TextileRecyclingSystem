from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class CustomUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # Superusers get the admin role; regular users must be given a role explicitly.
        extra_fields.setdefault('role', 'admin')
        return super().create_superuser(username, email, password, **extra_fields)


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('warehouse_supervisor', 'Warehouse Supervisor'),
        ('sorting_supervisor', 'Sorting Supervisor'),
        ('decolorization_supervisor', 'Decolorization Supervisor'),
        ('drying_supervisor', 'Drying Supervisor'),
    ]
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"