import os
import zipfile
import logging
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from apps.clients.models import Client
from apps.site_settings.models import SiteSetting
from .models import ZipBundle

logger = logging.getLogger(__name__)

def get_or_create_client_zip_bundle(client: Client) -> ZipBundle:
    """
    Retrieves an existing ready ZipBundle or builds a new multi-part ZIP bundle.
    Uses uncompressed ZIP_STORED mode per PRD for fast creation and zero re-compression CPU waste.
    """
    # Check if a ready bundle already exists and has photos matching current count
    existing_bundle = ZipBundle.objects.filter(
        client=client,
        status='ready'
    ).order_by('-built_at').first()

    current_ready_photos = client.photos.filter(status='ready', is_hidden=False)
    current_photo_count = current_ready_photos.count()

    if existing_bundle and existing_bundle.photo_count == current_photo_count and current_photo_count > 0:
        # Verify part files actually exist on disk
        all_parts_exist = True
        media_root = Path(settings.MEDIA_ROOT)
        for part in existing_bundle.parts:
            part_path = media_root / part.get('storage_key', '')
            if not part_path.exists():
                all_parts_exist = False
                break
        if all_parts_exist:
            return existing_bundle

    # Otherwise build or rebuild the bundle
    return build_client_zip_bundle(client)


def build_client_zip_bundle(client: Client) -> ZipBundle:
    """
    Builds multi-part uncompressed ZIP archives for all ready, non-hidden client photos.
    Splits parts according to 'zip_part_mb' setting (default ~1.5 GB).
    """
    delivery_settings = SiteSetting.get_setting('delivery')
    part_mb = int(delivery_settings.get('zip_part_mb', 1500))
    max_part_bytes = part_mb * 1024 * 1024

    bundle = ZipBundle.objects.create(
        client=client,
        status='building'
    )

    try:
        photos = list(client.photos.filter(status='ready', is_hidden=False).order_by('sort_order', 'created_at'))
        if not photos:
            bundle.status = 'ready'
            bundle.parts = []
            bundle.photo_count = 0
            bundle.total_bytes = 0
            bundle.built_at = timezone.now()
            bundle.save()
            return bundle

        media_root = Path(settings.MEDIA_ROOT)
        client_bundle_dir = media_root / 'zips' / str(client.id) / str(bundle.id)
        client_bundle_dir.mkdir(parents=True, exist_ok=True)

        parts_data = []
        current_part_num = 1
        current_part_bytes = 0
        current_part_photos = []
        all_parts = []

        # Partition photos into size-limited parts
        for photo in photos:
            photo_size = photo.size_bytes or 0
            # If adding this photo exceeds part limit and we already have photos in this part, rotate
            if current_part_photos and (current_part_bytes + photo_size > max_part_bytes):
                all_parts.append((current_part_num, current_part_photos))
                current_part_num += 1
                current_part_photos = [photo]
                current_part_bytes = photo_size
            else:
                current_part_photos.append(photo)
                current_part_bytes += photo_size

        if current_part_photos:
            all_parts.append((current_part_num, current_part_photos))

        total_bundle_bytes = 0

        # Create uncompressed ZIP file for each part
        for part_no, part_photos in all_parts:
            zip_filename = f"part_{part_no:02d}.zip"
            zip_path = client_bundle_dir / zip_filename
            storage_key = f"zips/{client.id}/{bundle.id}/{zip_filename}"

            used_names = set()
            with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_STORED) as zip_file:
                for idx, photo in enumerate(part_photos, start=1):
                    orig_file_path = media_root / photo.storage_key
                    if not orig_file_path.exists():
                        continue

                    # Ensure unique filename within the zip archive
                    base_name = photo.original_filename or f"photo_{photo.id}.jpg"
                    archive_name = base_name
                    if archive_name in used_names:
                        archive_name = f"{idx}_{base_name}"
                    used_names.add(archive_name)

                    zip_file.write(orig_file_path, arcname=archive_name)

            part_size = zip_path.stat().st_size
            total_bundle_bytes += part_size

            parts_data.append({
                'part': part_no,
                'filename': zip_filename,
                'storage_key': storage_key,
                'size_bytes': part_size,
                'photo_count': len(part_photos)
            })

        bundle.status = 'ready'
        bundle.parts = parts_data
        bundle.photo_count = len(photos)
        bundle.total_bytes = total_bundle_bytes
        bundle.built_at = timezone.now()
        bundle.save()
        logger.info(f"Successfully built ZIP bundle {bundle.id} with {len(parts_data)} parts for client {client.id}")
        return bundle

    except Exception as e:
        logger.error(f"Failed building ZIP bundle {bundle.id}: {e}", exc_info=True)
        bundle.status = 'failed'
        bundle.save()
        raise
