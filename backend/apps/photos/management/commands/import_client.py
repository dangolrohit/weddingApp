import os
import shutil
import mimetypes
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.photos.tasks import process_photo_task, update_client_storage_bytes

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heic', '.heif'}

class Command(BaseCommand):
    help = 'Imports backlog photos from a server directory into a client gallery without duplicating disk space'

    def add_arguments(self, parser):
        parser.add_argument('--client', type=str, required=True, help='UUID of the client')
        parser.add_argument('--path', type=str, required=True, help='Absolute or media-relative path to source folder')

    def handle(self, *args, **options):
        client_id = options['client']
        source_path_str = options['path']

        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            raise CommandError(f"Client with ID '{client_id}' does not exist.")

        # Resolve path
        source_path = Path(source_path_str)
        if not source_path.is_absolute():
            source_path = Path(settings.MEDIA_ROOT) / source_path

        if not source_path.exists() or not source_path.is_dir():
            raise CommandError(f"Source directory '{source_path}' does not exist or is not a directory.")

        self.stdout.write(f"Importing photos from {source_path} into client: {client.groom_name} & {client.bride_name}...")

        originals_dir = Path(settings.MEDIA_ROOT) / 'originals' / str(client.id)
        originals_dir.mkdir(parents=True, exist_ok=True)

        imported_count = 0
        total_bytes = 0
        current_showcase_count = client.photos.filter(showcase_order__isnull=False).count()

        files_to_import = [
            f for f in source_path.iterdir()
            if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS
        ]

        if not files_to_import:
            self.stdout.write(self.style.WARNING("No valid photo files found in the specified path."))
            return

        for file_path in files_to_import:
            ext = file_path.suffix.lower()
            file_size = file_path.stat().st_size

            photo = Photo.objects.create(
                client=client,
                original_filename=file_path.name,
                storage_key='',
                mime_type=mimetypes.guess_type(file_path.name)[0],
                size_bytes=file_size,
                status='processing'
            )

            # Target destination
            target_filename = f"{photo.id}{ext}"
            target_path = originals_dir / target_filename
            storage_key = f"originals/{client.id}/{target_filename}"

            # Move file instantly on disk without duplicating space
            shutil.move(str(file_path), str(target_path))

            photo.storage_key = storage_key

            # Automatically assign first 3 showcase photos if none set
            if current_showcase_count < 3:
                current_showcase_count += 1
                photo.showcase_order = current_showcase_count

            photo.save(update_fields=['storage_key', 'showcase_order'])

            # Queue background processing
            try:
                process_photo_task.delay(str(photo.id))
            except Exception:
                process_photo_task(str(photo.id))

            imported_count += 1
            total_bytes += file_size

        update_client_storage_bytes(client)

        mb = total_bytes / (1024 * 1024)
        self.stdout.write(self.style.SUCCESS(
            f"Successfully imported {imported_count} photos ({mb:.2f} MB) for {client.groom_name} & {client.bride_name}."
        ))
