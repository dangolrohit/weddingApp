import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.photos.models import UploadSession, Media
from apps.photos.services import s3_storage

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Cleans up abandoned S3 upload sessions, aborts uncompleted multipart uploads, and frees storage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Age threshold in hours for abandoned upload sessions (default: 24).'
        )
        parser.add_argument(
            '--delete-pending-media',
            action='store_true',
            help='Also delete pending media records that never finished uploading.'
        )

    def handle(self, *args, **options):
        hours = options['hours']
        delete_pending = options['delete_pending_media']
        threshold = timezone.now() - timedelta(hours=hours)

        self.stdout.write(f"Searching for upload sessions created before {threshold} or expired...")

        abandoned_sessions = UploadSession.objects.filter(
            state__in=['initiated', 'uploading']
        ).filter(
            expires_at__lte=timezone.now()
        ) | UploadSession.objects.filter(
            state__in=['initiated', 'uploading'],
            created_at__lte=threshold
        )

        total_sessions = abandoned_sessions.count()
        aborted_multiparts = 0
        cleaned_sessions = 0
        cleaned_media = 0

        for session in abandoned_sessions.select_related('media'):
            key = session.object_key
            upload_id = session.multipart_upload_id

            if upload_id:
                # Abort multipart upload on Garage S3 to reclaim allocated blocks
                success = s3_storage.abort_multipart_upload_server(key, upload_id)
                if success:
                    aborted_multiparts += 1
                    self.stdout.write(f"Aborted S3 multipart upload: {upload_id} for {key}")

            session.state = 'expired'
            session.save(update_fields=['state', 'updated_at'])
            cleaned_sessions += 1

            media = session.media
            if media and media.upload_status in ['pending', 'uploading']:
                if delete_pending:
                    # Remove the uncompleted media row entirely
                    media_id = media.id
                    media.delete()
                    cleaned_media += 1
                    self.stdout.write(f"Deleted unfinished media row: {media_id}")
                else:
                    media.upload_status = 'failed'
                    media.save(update_fields=['upload_status'])

        self.stdout.write(self.style.SUCCESS(
            f"Cleanup complete. Processed {cleaned_sessions}/{total_sessions} sessions. "
            f"Aborted {aborted_multiparts} multipart uploads on Garage S3. "
            f"Cleaned {cleaned_media} pending media records."
        ))
