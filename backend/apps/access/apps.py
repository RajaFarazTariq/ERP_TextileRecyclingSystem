from django.apps import AppConfig


class AccessConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.access'

    def ready(self):
        # Page access is checked before every API view's own permissions. Hooking it
        # in here covers all views at once, so a new module can't forget it.
        from rest_framework.views import APIView

        from .services import check_api_access

        if getattr(APIView.check_permissions, '_checks_page_access', False):
            return
        view_permissions = APIView.check_permissions

        def check_permissions(self, request):
            check_api_access(request)
            view_permissions(self, request)

        check_permissions._checks_page_access = True
        APIView.check_permissions = check_permissions
