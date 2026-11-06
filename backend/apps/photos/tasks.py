import os
import logging
from pathlib import Path
from datetime import datetime
from PIL import Image, ImageOps, ExifTags
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from .models import Photo, PhotoVariant
from .watermark import apply_watermark
from apps.site_settings.models import SiteSetting

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def process_photo_task(self, photo_id: str):
    """
    Background worker task to generate photo variants:
    - 400px WebP thumbnail
    - 1600px WebP preview (with optional watermark)
    - 1600px JPEG showcase if showcase_order is set
    - Strips GPS metadata
    - Updates storage_bytes and sets status to 'ready'
    """
    try:
        photo = Photo.objects.select_related('client').get(id=photo_id)
    except Photo.DoesNotExist:
        logger.error(f"Photo {photo_id} not found for processing.")
        return

    orig_path = Path(settings.MEDIA_ROOT) / photo.storage_key
    if not orig_path.exists():
        logger.error(f"Original photo file {orig_path} does not exist.")
        photo.status = 'failed'
        photo.save(update_fields=['status'])
        return

    try:
        client_id = str(photo.client.id)
        media_root = Path(settings.MEDIA_ROOT)

        thumbs_dir = media_root / 'thumbs' / client_id
        previews_dir = media_root / 'previews' / client_id
        showcase_dir = media_root / 'showcase' / client_id

        thumbs_dir.mkdir(parents=True, exist_ok=True)
        previews_dir.mkdir(parents=True, exist_ok=True)
        showcase_dir.mkdir(parents=True, exist_ok=True)

        with Image.open(orig_path) as img:
            # Handle EXIF orientation
            img = ImageOps.exif_transpose(img) or img

            # Extract EXIF date taken if available
            taken_at = None
            try:
                exif = img.getexif()
                if exif:
                    # 36867 = DateTimeOriginal, 306 = DateTime
                    dt_str = exif.get(36867) or exif.get(306)
                    if dt_str:
                        taken_at = datetime.strptime(str(dt_str)[:19], "%Y:%m:%d %H:%M:%S")
                        taken_at = timezone.make_aware(taken_at, timezone.utc)
            except Exception:
                pass

            photo.taken_at = taken_at
            photo.width, photo.height = img.size
            photo.save(update_fields=['taken_at', 'width', 'height'])

            # 1. Generate 400px Thumbnail (WebP)
            thumb_img = img.copy()
            thumb_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
            thumb_filename = f"{photo.id}_400.webp"
            thumb_path = thumbs_dir / thumb_filename
            thumb_storage_key = f"thumbs/{client_id}/{thumb_filename}"

            # Ensure RGB format before saving as WebP
            if thumb_img.mode in ('RGBA', 'P'):
                thumb_img = thumb_img.convert('RGB')
            thumb_img.save(thumb_path, format='WEBP', quality=85)
            thumb_size = thumb_path.stat().st_size

            PhotoVariant.objects.update_or_create(
                photo=photo,
                kind='thumb',
                defaults={
                    'storage_key': thumb_storage_key,
                    'width': thumb_img.width,
                    'height': thumb_img.height,
                    'size_bytes': thumb_size,
                }
            )

            # 2. Generate 1600px Preview (WebP)
            preview_img = img.copy()
            preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            if preview_img.mode in ('RGBA', 'P'):
                preview_img = preview_img.convert('RGB')

            # Check if watermark applies to preview
            wm_settings = SiteSetting.get_setting('watermark')
            if wm_settings.get('enabled') and wm_settings.get('apply_to_client_preview'):
                preview_img = apply_watermark(preview_img, wm_settings)

            preview_filename = f"{photo.id}_1600.webp"
            preview_path = previews_dir / preview_filename
            preview_storage_key = f"previews/{client_id}/{preview_filename}"
            preview_img.save(preview_path, format='WEBP', quality=88)
            preview_size = preview_path.stat().st_size

            PhotoVariant.objects.update_or_create(
                photo=photo,
                kind='preview',
                defaults={
                    'storage_key': preview_storage_key,
                    'width': preview_img.width,
                    'height': preview_img.height,
                    'size_bytes': preview_size,
                }
            )

            # 3. Generate Showcase Variant if photo is chosen for showcase
            if photo.showcase_order is not None:
                generate_showcase_variant(photo, img)

        # Update photo status to ready
        photo.status = 'ready'
        photo.save(update_fields=['status'])

        # Recalculate client total storage bytes
        update_client_storage_bytes(photo.client)

    except Exception as exc:
        logger.exception(f"Error processing photo {photo_id}: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        photo.status = 'failed'
        photo.save(update_fields=['status'])


def generate_showcase_variant(photo: Photo, source_img: Image.Image = None):
    """Generates the 1600px watermarked showcase JPEG image."""
    client_id = str(photo.client.id)
    showcase_dir = Path(settings.MEDIA_ROOT) / 'showcase' / client_id
    showcase_dir.mkdir(parents=True, exist_ok=True)

    if source_img is None:
        orig_path = Path(settings.MEDIA_ROOT) / photo.storage_key
        if not orig_path.exists():
            return
        img = Image.open(orig_path)
        img = ImageOps.exif_transpose(img) or img
    else:
        img = source_img.copy()

    img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    wm_settings = SiteSetting.get_setting('watermark')
    watermarked_img = apply_watermark(img, wm_settings)

    showcase_filename = f"{photo.id}_wm.jpg"
    showcase_path = showcase_dir / showcase_filename
    showcase_storage_key = f"showcase/{client_id}/{showcase_filename}"
    watermarked_img.save(showcase_path, format='JPEG', quality=90)
    showcase_size = showcase_path.stat().st_size

    PhotoVariant.objects.update_or_create(
        photo=photo,
        kind='showcase',
        defaults={
            'storage_key': showcase_storage_key,
            'width': watermarked_img.width,
            'height': watermarked_img.height,
            'size_bytes': showcase_size,
        }
    )


def update_client_storage_bytes(client):
    """Sums storage sizes for all photos and variants belonging to a client."""
    from django.db.models import Sum
    photos_sum = client.photos.aggregate(total=Sum('size_bytes'))['total'] or 0
    variants_sum = PhotoVariant.objects.filter(photo__client=client).aggregate(total=Sum('size_bytes'))['total'] or 0
    client.storage_bytes = photos_sum + variants_sum
    client.photo_count = client.photos.count()
    client.save(update_fields=['storage_bytes', 'photo_count'])
