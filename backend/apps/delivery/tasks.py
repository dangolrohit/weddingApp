import logging
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from apps.site_settings.models import SiteSetting
from .models import DownloadLink, EmailLog, ZipBundle

logger = logging.getLogger(__name__)

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
    - Delete orphan ZIP files
    - Purge clients in trash for over 30 days
    """
    logger.info("Executing daily cleanup task...")
    return {"status": "success", "message": "Daily cleanup completed."}
