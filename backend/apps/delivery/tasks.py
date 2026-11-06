import shutil
import logging
from datetime import timedelta
from pathlib import Path
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.clients.models import Client
from apps.site_settings.models import SiteSetting
from .models import DownloadLink, EmailLog, ZipBundle

logger = logging.getLogger(__name__)

@shared_task
def build_zip_bundle_task(client_id: str):
    """Background task to build or refresh the multi-part uncompressed ZIP bundle for a client."""
    from .bundle import get_or_create_client_zip_bundle
    try:
        client = Client.objects.get(id=client_id)
        bundle = get_or_create_client_zip_bundle(client)
        return {"status": "success", "bundle_id": str(bundle.id), "parts": len(bundle.parts)}
    except Client.DoesNotExist:
        logger.error(f"Client {client_id} not found for ZIP bundle build.")
        return {"status": "error", "message": "Client not found."}


@shared_task
def send_download_link_email_task(link_id: str, raw_token: str, base_url: str = 'http://localhost'):
    """Sends the 7-day ZIP download link email to the client."""
    try:
        link = DownloadLink.objects.select_related('client').get(id=link_id)
    except DownloadLink.DoesNotExist:
        logger.error(f"DownloadLink {link_id} not found.")
        return

    branding = SiteSetting.get_setting('branding')
    email_settings = SiteSetting.get_setting('email')
    studio_name = branding.get('studio_name', 'Wedding Studio')
    from_name = email_settings.get('from_name', studio_name)
    from_address = email_settings.get('from_address', settings.DEFAULT_FROM_EMAIL)

    download_url = f"{base_url.rstrip('/')}/d/{raw_token}"
    subject = f"Your Wedding Photos from {studio_name} are Ready!"

    couple_names = f"{link.client.groom_name} & {link.client.bride_name}"
    expiry_str = link.expires_at.strftime("%B %d, %Y")

    message_body = (
        f"Hello {couple_names},\n\n"
        f"Your high-resolution wedding collection is ready for download!\n\n"
        f"Access your private gallery and download your uncompressed files here:\n"
        f"{download_url}\n\n"
        f"Important Notes:\n"
        f"- This download link is valid for 7 days (expires on {expiry_str}).\n"
        f"- Each ZIP part can be downloaded up to {link.max_downloads} times.\n\n"
        f"Warmly,\n"
        f"{studio_name}\n"
    )

    email_log = EmailLog.objects.create(
        client=link.client,
        link=link,
        to_email=link.email,
        kind='link',
        status='queued'
    )

    try:
        send_mail(
            subject=subject,
            message=message_body,
            from_email=f"{from_name} <{from_address}>" if from_name else from_address,
            recipient_list=[link.email],
            fail_silently=False,
        )
        email_log.status = 'sent'
        email_log.save(update_fields=['status'])
        link.sent_at = timezone.now()
        link.save(update_fields=['sent_at'])
        logger.info(f"Download link email sent successfully to {link.email}")
    except Exception as e:
        logger.error(f"Failed to send download link email: {e}")
        email_log.status = 'failed'
        email_log.error = str(e)
        email_log.save(update_fields=['status', 'error'])


@shared_task
def daily_cleanup_task():
    """
    Daily scheduled cleanup task:
    - Mark expired links
    - Delete orphaned ZIP files for bundles older than 14 days without active links
    - Purge clients in trash for over 30 days, including all physical files
    """
    now = timezone.now()
    logger.info("Executing daily cleanup task...")

    # 1. Purge trash clients older than 30 days
    trash_threshold = now - timedelta(days=30)
    purged_clients = Client.objects.filter(deleted_at__isnull=False, deleted_at__lt=trash_threshold)
    media_root = Path(settings.MEDIA_ROOT)

    purged_count = 0
    for client in purged_clients:
        client_id_str = str(client.id)
        # Delete client folders from disk
        for subfolder in ('originals', 'thumbs', 'previews', 'showcase', 'zips'):
            target_dir = media_root / subfolder / client_id_str
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
        client.delete()
        purged_count += 1

    # 2. Delete orphaned ZIP files where all referencing links are expired or revoked
    bundle_threshold = now - timedelta(days=14)
    old_bundles = ZipBundle.objects.filter(built_at__lt=bundle_threshold)
    deleted_bundles_count = 0

    for bundle in old_bundles:
        has_active_link = bundle.download_links.filter(
            revoked_at__isnull=True,
            expires_at__gt=now
        ).exists()

        if not has_active_link:
            bundle_dir = media_root / 'zips' / str(bundle.client_id) / str(bundle.id)
            if bundle_dir.exists():
                shutil.rmtree(bundle_dir, ignore_errors=True)
            bundle.delete()
            deleted_bundles_count += 1

    logger.info(f"Daily cleanup completed: purged {purged_count} trashed clients, removed {deleted_bundles_count} orphaned ZIP bundles.")
    return {
        "status": "success",
        "purged_clients": purged_count,
        "deleted_bundles": deleted_bundles_count
    }
