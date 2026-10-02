from django.contrib import admin

from .models import Role, RoleDuty, RolePage, UserPageOverride

admin.site.register([Role, RoleDuty, RolePage, UserPageOverride])
