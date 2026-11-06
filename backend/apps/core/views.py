from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.clients.models import Client
from apps.categories.models import Category
from apps.photos.models import Photo
from apps.delivery.models import DownloadLink, ZipBundle
from apps.storage_stats.tasks import get_system_storage_stats
from .models import ActivityLog

class AdminDashboardView(APIView):
    """
    Consolidated analytics dashboard metrics for the studio administrator.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # 1. Clients metrics
        clients_qs = Client.objects.filter(deleted_at__isnull=True)
        total_clients = clients_qs.count()
        new_clients_month = clients_qs.filter(created_at__gte=start_of_month).count()

        # 2. Photos metrics
        total_photos = Photo.objects.filter(client__deleted_at__isnull=True, status='ready').count()

        # 3. Categories distribution
        categories_data = []
        for cat in Category.objects.all().order_by('sort_order', 'name'):
            client_count = cat.clients.filter(deleted_at__isnull=True).count()
            categories_data.append({
                'id': str(cat.id),
                'name': cat.name,
                'slug': cat.slug,
                'client_count': client_count,
            })

        # 4. Storage numbers
        storage_stats = get_system_storage_stats()

        # 5. Pending work
        photos_processing = Photo.objects.filter(status='processing').count()
        photos_failed = Photo.objects.filter(status='failed').count()
        zips_building = ZipBundle.objects.filter(status='building').count()

        # 6. Links status
        active_links = DownloadLink.objects.filter(revoked_at__isnull=True, expires_at__gt=now).count()
        expiring_soon_links = DownloadLink.objects.filter(
            revoked_at__isnull=True,
            expires_at__gt=now,
            expires_at__lte=now + timedelta(days=7)
        ).count()

        # 7. Recent clients (last 5)
        recent_clients = []
        for c in clients_qs.order_by('-created_at')[:5]:
            recent_clients.append({
                'id': str(c.id),
                'groom_name': c.groom_name,
                'bride_name': c.bride_name,
                'status': c.status,
                'photo_count': c.photo_count,
                'event_date': c.event_date,
                'created_at': c.created_at,
            })

        # 8. Recent activity (last 10)
        recent_activity = []
        for a in ActivityLog.objects.order_by('-created_at')[:10]:
            recent_activity.append({
                'id': str(a.id),
                'action': a.action,
                'user': a.user.name or a.user.email if a.user else 'System',
                'entity_type': a.entity_type,
                'metadata': a.metadata,
                'created_at': a.created_at,
            })

        # 9. Monthly clients chart (past 6 months)
        chart_data = []
        for i in range(5, -1, -1):
            target_date = now - timedelta(days=i * 30)
            month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year + 1, month=1)
            else:
                next_month = month_start.replace(month=month_start.month + 1)

            month_label = month_start.strftime("%b %Y")
            count = clients_qs.filter(created_at__gte=month_start, created_at__lt=next_month).count()
            chart_data.append({
                'month': month_label,
                'count': count
            })

        return Response({
            'total_clients': total_clients,
            'new_clients_this_month': new_clients_month,
            'total_photos': total_photos,
            'categories': categories_data,
            'storage': {
                'total_bytes': storage_stats['total_disk_bytes'],
                'free_bytes': storage_stats['free_disk_bytes'],
                'used_bytes': storage_stats['used_disk_bytes'],
                'usage_percent': storage_stats['disk_usage_percent'],
                'warning': storage_stats['disk_warning'],
                'platform_bytes': storage_stats['breakdown']['total_platform'],
            },
            'pending_work': {
                'photos_processing': photos_processing,
                'photos_failed': photos_failed,
                'zips_building': zips_building,
            },
            'download_links': {
                'active': active_links,
                'expiring_soon': expiring_soon_links,
            },
            'recent_clients': recent_clients,
            'recent_activity': recent_activity,
            'chart': chart_data,
        }, status=status.HTTP_200_OK)

