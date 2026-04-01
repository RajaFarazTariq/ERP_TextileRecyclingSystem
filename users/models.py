from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('warehouse_supervisor', 'Warehouse Supervisor'),
        ('sorting_supervisor', 'Sorting Supervisor'),
        ('decolorization_supervisor', 'Decolorization Supervisor'),
        ('drying_supervisor', 'Drying Supervisor'),
    ]
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='admin')

    def __str__(self):
        return f"{self.username} ({self.role})"