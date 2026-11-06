import io
from pathlib import Path
from PIL import Image
from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.delivery.models import DownloadLink, DownloadLog, ZipBundle
from apps.delivery.tasks import daily_cleanup_task
from apps.core.utils import generate_download_token, hash_download_token

def create_test_image(width=800, height=600, color='crimson'):
    file_io = io.BytesIO()
    img = Image.new('RGB', (width, height), color=color)
    img.save(file_io, format='JPEG')
    file_io.seek(0)
    return file_io

class DeliveryPhase6Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.com",
            name="Admin",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.admin)

        self.wedding_client = Client.objects.create(
            groom_name="Oliver",
            bride_name="Charlotte",
            status="published",
            created_by=self.admin
        )

        # Create dummy photos on disk for bundling
        orig_dir = Path(settings.MEDIA_ROOT) / 'originals' / str(self.wedding_client.id)
        orig_dir.mkdir(parents=True, exist_ok=True)

        for i in range(3):
            img_bytes = create_test_image(800, 600)
            file_path = orig_dir / f"pic_{i}.jpg"
            with open(file_path, 'wb') as f:
                f.write(img_bytes.read())

            Photo.objects.create(
                client=self.wedding_client,
                original_filename=f"pic_{i}.jpg",
                storage_key=f"originals/{self.wedding_client.id}/pic_{i}.jpg",
                size_bytes=file_path.stat().st_size,
                status='ready'
            )

    def test_admin_send_link_creates_zip_and_link(self):
        url = reverse('admin_send_link', kwargs={'client_id': self.wedding_client.id})
        payload = {
            'email': 'oliver@example.com',
            'save_email': True,
            'revoke_previous': True
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('raw_token', response.data)
        self.assertIn('download_url', response.data)

        # Check client email locked
        self.wedding_client.refresh_from_db()
        self.assertEqual(self.wedding_client.linked_email, 'oliver@example.com')
        self.assertTrue(self.wedding_client.email_locked)

        # Check ZipBundle built
        bundle = ZipBundle.objects.filter(client=self.wedding_client).first()
        self.assertIsNotNone(bundle)
        self.assertEqual(bundle.status, 'ready')
        self.assertGreater(len(bundle.parts), 0)

        # Check DownloadLink created
        link = DownloadLink.objects.filter(client=self.wedding_client).first()
        self.assertIsNotNone(link)
        self.assertEqual(link.email, 'oliver@example.com')

    def test_admin_client_links_and_revoke(self):
        # Create a link
        send_url = reverse('admin_send_link', kwargs={'client_id': self.wedding_client.id})
        res = self.client.post(send_url, {'email': 'test@client.com', 'save_email': False, 'revoke_previous': False}, format='json')
        link_id = res.data['link']['id']

        # Get links
        list_url = reverse('admin_client_links', kwargs={'client_id': self.wedding_client.id})
        list_res = self.client.get(list_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 1)
        self.assertTrue(list_res.data[0]['is_active'])

        # Revoke link
        revoke_url = reverse('admin_revoke_link', kwargs={'link_id': link_id})
        rev_res = self.client.post(revoke_url)
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)

        # Verify revoked
        link = DownloadLink.objects.get(id=link_id)
        self.assertIsNotNone(link.revoked_at)
        self.assertFalse(link.is_active)

    def test_public_download_flow(self):
        # Create a link through admin
        send_url = reverse('admin_send_link', kwargs={'client_id': self.wedding_client.id})
        send_res = self.client.post(send_url, {'email': 'couple@test.com', 'save_email': False, 'revoke_previous': False}, format='json')
        raw_token = send_res.data['raw_token']

        # Unauthenticated client opens /d/{token}
        self.client.force_authenticate(user=None)
        status_url = reverse('public_download_status', kwargs={'token': raw_token})
        status_res = self.client.get(status_url)

        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data['status'], 'active')
        self.assertEqual(len(status_res.data['parts']), 1)
        self.assertIn("Oliver & Charlotte", status_res.data['client_names'])

        # Download Part 1
        part_url = reverse('public_download_part', kwargs={'token': raw_token, 'part_no': 1})
        part_res = self.client.get(part_url)

        self.assertEqual(part_res.status_code, status.HTTP_200_OK)
        # Check download count incremented
        token_hash = hash_download_token(raw_token)
        link = DownloadLink.objects.get(token_hash=token_hash)
        self.assertEqual(link.download_count, 1)

        # Check download log audit recorded
        self.assertTrue(DownloadLog.objects.filter(link=link, part_no=1).exists())

    def test_public_download_expired_link(self):
        send_url = reverse('admin_send_link', kwargs={'client_id': self.wedding_client.id})
        send_res = self.client.post(send_url, {'email': 'exp@test.com', 'save_email': False, 'revoke_previous': False}, format='json')
        raw_token = send_res.data['raw_token']

        # Manually backdate link expiry
        token_hash = hash_download_token(raw_token)
        link = DownloadLink.objects.get(token_hash=token_hash)
        link.expires_at = timezone.now() - timedelta(days=1)
        link.save(update_fields=['expires_at'])

        self.client.force_authenticate(user=None)
        status_url = reverse('public_download_status', kwargs={'token': raw_token})
        status_res = self.client.get(status_url)

        self.assertEqual(status_res.status_code, status.HTTP_410_GONE)
        self.assertEqual(status_res.data['status'], 'expired')

