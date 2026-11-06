from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'app': 'wedding-photo-platform'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health_check, name='health_check'),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.categories.urls')),
    path('api/', include('apps.clients.urls')),
    path('api/', include('apps.site_settings.urls')),
    path('api/public/', include('apps.public_site.urls')),
    path('', include('apps.photos.urls')),
]

if getattr(settings, 'SERVE_DIRECT_MEDIA', False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
