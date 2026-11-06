import shutil
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.clients.models import Client
from apps.delivery.models import ZipBundle, DownloadLink
from apps.core.models import log_activity
from .tasks import get_system_storage_stats, recalculate_storage_task

class StorageOverviewView(APIView):
    """
    Returns total disk usage, free space, 80% threshold warning,
    media subfolder breakdown, and per-client storage usage.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = get_system_storage_stats()

        ordering = request.query_params.get('ordering', '-storage_bytes')
        valid_orders = ['storage_bytes', '-storage_bytes', 'photo_count', '-photo_count', 'groom_name', '-groom_name', 'created_at', '-created_at']
        if ordering not in valid_orders:
            ordering = '-storage_bytes'

        clients_qs = Client.objects.filter(deleted_at__isnull=True).order_by(ordering)
        client_usage = []
        for c in clients_qs:
            client_usage.append({
                'id': str(c.id),
                'groom_name': c.groom_name,
                'bride_name': c.bride_name,
                'event_date': c.event_date,
                'status': c.status,
                'photo_count': c.photo_count,
                'storage_bytes': c.storage_bytes,
            })

        return Response({
            'system_disk': {
                'total_bytes': stats['total_disk_bytes'],
                'used_bytes': stats['used_disk_bytes'],
                'free_bytes': stats['free_disk_bytes'],
                'usage_percent': stats['disk_usage_percent'],
                'warning': stats['disk_warning'],
            },
            'breakdown': stats['breakdown'],
            'client_usage': client_usage,
        }, status=status.HTTP_200_OK)


class StorageRecalculateView(APIView):
    """Reconciles database numbers with physical files on disk."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        result = recalculate_storage_task()
        log_activity(
            action='storage_recalculated',
            user=request.user,
            metadata=result,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response({
            'detail': f"Storage recalculated successfully for {result.get('clients_updated', 0)} clients.",
            'result': result
        }, status=status.HTTP_200_OK)


class StorageClearZipsView(APIView):
    """
    Cleans up expired or unreferenced ZIP archives from disk to reclaim storage.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        media_root = Path(settings.MEDIA_ROOT)
        reclaimed_bytes = 0
        cleared_bundles_count = 0

        # Find bundles where no active download links exist
        bundles = ZipBundle.objects.all()
        for bundle in bundles:
            has_active_link = bundle.download_links.filter(
                revoked_at__isnull=True,
                expires_at__gt=now
            ).exists()

            if not has_active_link:
                bundle_dir = media_root / 'zips' / str(bundle.client_id) / str(bundle.id)
                if bundle_dir.exists():
                    try:
                        dir_size = sum(f.stat().st_size for f in bundle_dir.glob('**/*') if f.is_file())
                        shutil.rmtree(bundle_dir, ignore_errors=True)
                        reclaimed_bytes += dir_size
                    except Exception:
                        pass
                cleared_bundles_count += 1
                bundle.parts = []
                bundle.status = 'queued'
                bundle.save(update_fields=['parts', 'status'])

        log_activity(
            action='expired_zips_cleared',
            user=request.user,
            metadata={'reclaimed_bytes': reclaimed_bytes, 'cleared_bundles': cleared_bundles_count},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'detail': f'Cleared {cleared_bundles_count} expired ZIP bundles. Reclaimed {reclaimed_bytes} bytes.',
            'reclaimed_bytes': reclaimed_bytes,
            'cleared_bundles': cleared_bundles_count,
        }, status=status.HTTP_200_OK)
