"""A small "is it up" check for Docker, load balancers and uptime monitors."""
from django.db import connection
from django.http import JsonResponse


def health(request):
    """200 when the app can reach its database, 503 when it can't. Shows nothing sensitive."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        return JsonResponse({'status': 'error', 'database': 'unreachable'}, status=503)
    return JsonResponse({'status': 'ok', 'database': 'ok'})
