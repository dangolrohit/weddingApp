import io
from pathlib import Path
from PIL import Image
from django.test import TestCase
from django.urls import reverse
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.photos.tasks import process_photo_task
from apps.core.utils import sign_client_session

def create_test_image(width=800, height=600, color='teal'):
    file_io = io.BytesIO()
    img = Image.new('RGB', (width, height), color=color)
    img.save(file_io, format='JPEG')
    file_io.seek(0)
    return file_io

class SecurityHardeningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="security@studio.com",
            name="Security Admin",
            password="SecurePassword123!"
        )

        self.category = Category.objects.create(name="Ceremony")
        self.client_a = Client.objects.create(
            groom_name="Romeo",
            bride_name="Juliet",
            category=self.category,
            status="published",
            created_by=self.admin
        )
        self.client_b = Client.objects.create(
            groom_name="Othello",
            bride_name="Desdemona",
            category=self.category,
            status="published",
            created_by=self.admin
        )

        # Create dummy photo on disk for Client B
        orig_dir = Path(settings.MEDIA_ROOT) / 'originals' / str(self.client_b.id)
        orig_dir.mkdir(parents=True, exist_ok=True)
        img_bytes = create_test_image(800, 600)
        file_path = orig_dir / "secret_b.jpg"
        with open(file_path, 'wb') as f:
            f.write(img_bytes.read())

        self.photo_b = Photo.objects.create(
            client=self.client_b,
            original_filename="secret_b.jpg",
            storage_key=f"originals/{self.client_b.id}/secret_b.jpg",
            status='ready'
        )
        process_photo_task(str(self.photo_b.id))

    def test_path_traversal_on_branding(self):
        # Attempting path traversal with encoded or literal traversal tokens
        res1 = self.client.get('/files/branding/..%2F..%2Fetc%2Fpasswd')
        self.assertIn(res1.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST))

        res2 = self.client.get('/files/branding/..\\..\\windows\\win.ini')
        self.assertIn(res2.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST))

    def test_path_traversal_on_variants(self):
        # Passing malformed or traversal id
        res1 = self.client.get('/files/preview/..%2F..%2Fetc%2Fpasswd')
        self.assertIn(res1.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST))

        res2 = self.client.get('/files/preview/non-existent-uuid-string')
        self.assertEqual(res2.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_client_isolation(self):
        # Client A authenticates with their own signed session
        token_a = sign_client_session(str(self.client_a.id))

        # Client A attempts to view Client B's private photo preview
        url = reverse('protected_file_serve', kwargs={'kind': 'preview', 'file_id': self.photo_b.id})
        res = self.client.get(url, HTTP_X_CLIENT_SESSION=token_a)

        # Must be strictly forbidden!
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_preview_denied(self):
        # Public visitor without token attempts to view private preview
        url = reverse('protected_file_serve', kwargs={'kind': 'preview', 'file_id': self.photo_b.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_image_upload_rejected(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin_client_photos', kwargs={'client_id': self.client_a.id})

        # Attempt to upload malicious script
        evil_script = SimpleUploadedFile("malicious.sh", b"#!/bin/bash\nrm -rf /", content_type="application/x-sh")
        response = self.client.post(url, {'file': evil_script}, format='multipart')

        # Should be filtered out and not create photos
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 0)
        self.assertFalse(Photo.objects.filter(original_filename='malicious.sh').exists())
