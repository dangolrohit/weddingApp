import os
import shutil
import logging
from pathlib import Path
from celery import shared_task
from django.conf import settings
from apps.clients.models import Client
from apps.photos.models import Photo, PhotoVariant

logger = logging.getLogger(__name__)

def get_directory_size(path: Path) -> int:
    """Calculates total size in bytes of a directory tree."""
    if not path.exists():
        return 0
    total = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False):
                total += entry.stat().st_size
            elif entry.is_dir(follow_symlinks=False):
                total += get_directory_size(Path(entry.path))
    except (PermissionError, FileNotFoundError):
        pass
    return total

def get_system_storage_stats() -> dict:
    """Calculates host disk capacity, available space, and media breakdown."""
    media_root = Path(settings.MEDIA_ROOT)
    media_root.mkdir(parents=True, exist_ok=True)

    try:
        total_disk, used_disk, free_disk = shutil.disk_usage(media_root)
    except Exception:
        total_disk, used_disk, free_disk = 1, 0, 1

    percent_used = round((used_disk / total_disk) * 100, 1) if total_disk > 0 else 0

    orig_bytes = get_directory_size(media_root / 'originals')
    thumbs_bytes = get_directory_size(media_root / 'thumbs')
    previews_bytes = get_directory_size(media_root / 'previews')
    showcase_bytes = get_directory_size(media_root / 'showcase')
    zips_bytes = get_directory_size(media_root / 'zips')

    platform_total = orig_bytes + thumbs_bytes + previews_bytes + showcase_bytes + zips_bytes

    return {
        'total_disk_bytes': total_disk,
        'used_disk_bytes': used_disk,
        'free_disk_bytes': free_disk,
        'disk_usage_percent': percent_used,
        'disk_warning': percent_used >= 80.0,
        'breakdown': {
            'originals': orig_bytes,
            'thumbs': thumbs_bytes,
            'previews': previews_bytes,
            'showcase': showcase_bytes,
            'zips': zips_bytes,
            'total_platform': platform_total,
        }
    }

@shared_task
def recalculate_storage_task() -> dict:
    """
    Nightly storage recalculation task to reconcile database numbers with actual files on disk.
    Updates Photo.size_bytes, PhotoVariant.size_bytes, Client.storage_bytes, and Client.photo_count.
    """
    logger.info("Executing storage recalculation task...")
    media_root = Path(settings.MEDIA_ROOT)
    recalculated_clients = 0
    total_bytes_tracked = 0

    for client in Client.objects.all():
        client_photos = client.photos.all()
        client_photo_bytes = 0

        for photo in client_photos:
            file_path = media_root / photo.storage_key if photo.storage_key else None
            if file_path and file_path.exists():
                size = file_path.stat().st_size
                if photo.size_bytes != size:
                    photo.size_bytes = size
                    photo.save(update_fields=['size_bytes'])
                client_photo_bytes += size

        variants_bytes = 0
        for variant in PhotoVariant.objects.filter(photo__client=client):
            v_path = media_root / variant.storage_key if variant.storage_key else None
            if v_path and v_path.exists():
                v_size = v_path.stat().st_size
                if variant.size_bytes != v_size:
                    variant.size_bytes = v_size
                    variant.save(update_fields=['size_bytes'])
                variants_bytes += v_size

        client.storage_bytes = client_photo_bytes + variants_bytes
        client.photo_count = client.photos.count()
        client.save(update_fields=['storage_bytes', 'photo_count'])

        recalculated_clients += 1
        total_bytes_tracked += client.storage_bytes

    logger.info(f"Storage recalculation complete: {recalculated_clients} clients updated, {total_bytes_tracked} bytes tracked.")
    return {
        'status': 'success',
        'clients_updated': recalculated_clients,
        'total_bytes': total_bytes_tracked
    }
