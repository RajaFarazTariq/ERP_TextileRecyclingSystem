"""
setup_fresh.py
──────────────
Run this ONCE after cloning the repo.
Creates a clean database with only a Test_User account — no demo data.

Usage:
    python setup_fresh.py

What it does:
    1. Runs all migrations (creates fresh db.sqlite3)
    2. Creates Test_User with admin role
    3. Prints login credentials
"""

import os
import sys
import django

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Backend.settings')
django.setup()

from django.core.management import call_command
from users.models import CustomUser

print("\n" + "═" * 55)
print("  Textile ERP — Fresh Setup")
print("═" * 55)

# ── Run migrations ────────────────────────────────────────
print("\n[1/3] Running migrations...")
call_command('migrate', verbosity=1)

# ── Create Test_User ──────────────────────────────────────
print("\n[2/3] Creating Test_User...")

if CustomUser.objects.filter(username='Test_User').exists():
    print("  ℹ  Test_User already exists — skipping creation")
    user = CustomUser.objects.get(username='Test_User')
    user.role = 'admin'
    user.set_password('Test@1234')
    user.is_active  = True
    user.is_staff   = True
    user.is_superuser = True
    user.save()
    print("  ✓ Test_User password reset to Test@1234")
else:
    user = CustomUser.objects.create_superuser(
        username   = 'Test_User',
        email      = 'testuser@gmail.com',
        password   = 'Test@1234',
        first_name = 'Test',
        last_name  = 'User',
    )
    user.role = 'admin'
    user.save()
    print("  ✓ Test_User created")

# ── Done ──────────────────────────────────────────────────
print("\n[3/3] Setup complete!")
print("\n" + "═" * 55)
print("  LOGIN CREDENTIALS")
print("  ─────────────────────────────────────────")
print("  Username : Test_User")
print("  Password : Test@1234")
print("  Role     : Admin (access to all modules)")
print("═" * 55)
print("\n  Start the server:")
print("  python manage.py runserver")
print()
