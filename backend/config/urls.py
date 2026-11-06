import sys
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def health_check(request):
    checks = {'database': True, 'redis': True}
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
    except Exception:
        checks['database'] = False

    try:
        import redis
        client = redis.from_url(getattr(settings, 'CELERY_BROKER_URL', 'redis://redis:6379/0'), socket_connect_timeout=1)
        client.ping()
    except Exception:
        checks['redis'] = False

    is_test = 'test' in sys.argv or getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False)
    is_healthy = checks['database'] and (checks['redis'] or is_test)
    status_code = 200 if is_healthy else 503
    return JsonResponse({
        'status': 'ok' if is_healthy else 'degraded',
        'checks': checks,
        'app': 'wedding-photo-platform'
    }, status=status_code)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health_check, name='health_check'),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.categories.urls')),
    path('api/', include('apps.clients.urls')),
    path('api/', include('apps.site_settings.urls')),
    path('api/public/', include('apps.public_site.urls')),
    path('api/', include('apps.delivery.urls')),
    path('api/', include('apps.storage_stats.urls')),
    path('api/', include('apps.payments.urls')),
    path('api/', include('apps.equipment.urls')),
    path('api/', include('apps.core.urls')),
    path('', include('apps.photos.urls')),
]

if getattr(settings, 'SERVE_DIRECT_MEDIA', False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
