from django.contrib import admin

from .models import RolePage, UserPageOverride

admin.site.register([RolePage, UserPageOverride])
