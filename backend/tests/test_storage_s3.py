from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clients.models import Client
from apps.photos.models import Album, Media, UploadSession
from apps.photos.services import s3_storage
from apps.core.utils import generate_download_token, hash_download_token


class StorageS3Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@studio.com",
            name="Admin User",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.admin)

        # Client A
        self.client_a = Client.objects.create(
            groom_name="Robert",
            bride_name="Chloe",
            created_by=self.admin,
            status="published"
        )

        # Client B
        self.client_b = Client.objects.create(
            groom_name="Daniel",
            bride_name="Sarah",
            created_by=self.admin,
            status="published"
        )

        # Album for Client A
        self.album_a = Album.objects.create(
            client=self.client_a,
            title="Robert & Chloe Wedding",
            description="Official wedding gallery",
            status="published",
            created_by=self.admin
        )

        # Album for Client B
        self.album_b = Album.objects.create(
            client=self.client_b,
            title="Daniel & Sarah Ceremony",
            status="published",
            created_by=self.admin
        )

    def test_album_creation_and_listing(self):
        """Admin can list and create albums for a specific client."""
        url = reverse('admin_client_albums', kwargs={'client_id': self.client_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['title'], "Robert & Chloe Wedding")

        # Create second album
        create_res = self.client.post(url, {'title': 'Reception Evening', 'description': 'Dance & cake'}, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Album.objects.filter(client=self.client_a).count(), 2)

    def test_server_controlled_key_generation_and_filename_sanitization(self):
        """Prepare upload endpoint strictly sanitizes filenames and controls object keys."""
        url = reverse('admin_album_media_prepare', kwargs={'album_id': self.album_a.id})
        payload = {
            'filename': '../../malicious_path/wedding photo #1.JPG',
            'content_type': 'image/jpeg',
            'byte_size': 15000000,
            'is_archive': False
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        self.assertIn('media_id', data)
        self.assertIn('object_key', data)
        # Server must enforce key prefix and strip path traversal
        self.assertTrue(data['object_key'].startswith(f"albums/{self.album_a.id}/photos/"))
        self.assertNotIn('../../', data['object_key'])

        # Media record is in pending state
        media = Media.objects.get(id=data['media_id'])
        self.assertEqual(media.upload_status, 'pending')
        self.assertEqual(media.media_type, 'photo')

        # Upload session is initiated
        session = UploadSession.objects.get(object_key=data['object_key'])
        self.assertEqual(session.state, 'initiated')

    def test_signing_authorization_and_cross_client_isolation(self):
        """Clients or users cannot sign requests for object keys belonging to another album."""
        # 1. Prepare file on Album A
        prep_url = reverse('admin_album_media_prepare', kwargs={'album_id': self.album_a.id})
        prep_res = self.client.post(prep_url, {'filename': 'photo.jpg', 'byte_size': 5000}, format='json')
        key_a = prep_res.data['object_key']

        # 2. Try to sign key_a under Album B -> Must be rejected with 403 Forbidden!
        sign_url_b = reverse('admin_album_s3_sign', kwargs={'album_id': self.album_b.id})
        tamper_res = self.client.post(sign_url_b, {
            'method': 'PUT',
            'key': key_a,
        }, format='json')
        self.assertEqual(tamper_res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Try to sign completely arbitrary client-supplied path -> 403 Forbidden!
        arbitrary_res = self.client.post(sign_url_b, {
            'method': 'PUT',
            'key': 'arbitrary/path/overwrite.jpg',
        }, format='json')
        self.assertEqual(arbitrary_res.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Legitimate sign under Album A succeeds and returns presigned URL without passing file content through backend
        sign_url_a = reverse('admin_album_s3_sign', kwargs={'album_id': self.album_a.id})
        valid_res = self.client.post(sign_url_a, {
            'method': 'PUT',
            'key': key_a,
            'contentType': 'image/jpeg'
        }, format='json')
        self.assertEqual(valid_res.status_code, status.HTTP_200_OK)
        self.assertIn('url', valid_res.data)
        self.assertIn('X-Amz-Signature', valid_res.data['url'])
        self.assertEqual(valid_res.data['key'], key_a)

    def test_multipart_signing_methods(self):
        """Supports POST (create multipart), PUT (upload part), POST (complete), and DELETE (abort)."""
        prep_url = reverse('admin_album_media_prepare', kwargs={'album_id': self.album_a.id})
        prep_res = self.client.post(prep_url, {'filename': 'large_video.mp4', 'byte_size': 5000000000}, format='json')
        key = prep_res.data['object_key']

        sign_url = reverse('admin_album_s3_sign', kwargs={'album_id': self.album_a.id})

        # Step A: Initiate multipart
        init_res = self.client.post(sign_url, {'method': 'POST', 'key': key}, format='json')
        self.assertEqual(init_res.status_code, status.HTTP_200_OK)
        self.assertIn('uploads=', init_res.data['url'])

        # Step B: Sign Part 1
        part_res = self.client.post(sign_url, {
            'method': 'PUT',
            'key': key,
            'uploadId': 'mock-upload-id-123',
            'partNumber': 1
        }, format='json')
        self.assertEqual(part_res.status_code, status.HTTP_200_OK)
        self.assertIn('partNumber=1', part_res.data['url'])
        self.assertIn('uploadId=mock-upload-id-123', part_res.data['url'])

        # Step C: Sign Complete
        comp_res = self.client.post(sign_url, {
            'method': 'POST',
            'key': key,
            'uploadId': 'mock-upload-id-123'
        }, format='json')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertIn('uploadId=mock-upload-id-123', comp_res.data['url'])

        # Step D: Sign Abort
        abort_res = self.client.post(sign_url, {
            'method': 'DELETE',
            'key': key,
            'uploadId': 'mock-upload-id-123'
        }, format='json')
        self.assertEqual(abort_res.status_code, status.HTTP_200_OK)
        self.assertIn('uploadId=mock-upload-id-123', abort_res.data['url'])

    @patch('apps.photos.services.s3_storage.verify_and_get_object_metadata')
    def test_server_side_verification_before_marking_ready(self, mock_verify):
        """Backend calls S3 head_object to verify object existence before setting status to ready."""
        prep_url = reverse('admin_album_media_prepare', kwargs={'album_id': self.album_a.id})
        prep_res = self.client.post(prep_url, {'filename': 'verified.jpg', 'byte_size': 12345}, format='json')
        media_id = prep_res.data['media_id']

        # Scenario 1: Object not found on S3 -> returns 400 and marks status failed
        mock_verify.side_effect = s3_storage.StorageNotFoundError("Missing")
        complete_url = reverse('admin_album_media_complete', kwargs={'album_id': self.album_a.id, 'media_id': media_id})
        fail_res = self.client.post(complete_url)
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)
        media = Media.objects.get(id=media_id)
        self.assertEqual(media.upload_status, 'failed')

        # Scenario 2: Object verified on S3 -> marks ready and updates client storage
        initial_storage = self.client_a.storage_bytes
        mock_verify.side_effect = None
        mock_verify.return_value = {'size': 2048000, 'etag': 'etag-abc-123', 'content_type': 'image/jpeg'}
        ok_res = self.client.post(complete_url)
        self.assertEqual(ok_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_res.data['status'], 'ready')

        media.refresh_from_db()
        self.assertEqual(media.upload_status, 'ready')
        self.assertEqual(media.byte_size, 2048000)
        self.assertEqual(media.etag, 'etag-abc-123')

        self.client_a.refresh_from_db()
        self.assertEqual(self.client_a.storage_bytes, initial_storage + 2048000)

    def test_share_token_generation_expiry_and_revocation(self):
        """High-entropy share token is hashed in DB; expiring and revoked links return 410 Gone."""
        share_url = reverse('admin_album_share_link', kwargs={'album_id': self.album_a.id})
        res = self.client.post(share_url, {'expires_in_days': 14}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        raw_token = res.data['share_token']
        self.assertTrue(len(raw_token) >= 40)

        # DB stores only the hash, never the raw token
        self.album_a.refresh_from_db()
        self.assertEqual(self.album_a.share_token_hash, hash_download_token(raw_token))
        self.assertTrue(self.album_a.is_share_active)

        # Public client gallery accesses album via raw token
        client_api = APIClient()  # Unauthenticated public client
        public_url = reverse('client_album_view', kwargs={'share_token': raw_token})
        pub_res = client_api.get(public_url)
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data['results']['album']['title'], self.album_a.title)

        # Revoke share access
        revoke_url = reverse('admin_album_revoke_share', kwargs={'album_id': self.album_a.id})
        self.client.post(revoke_url)
        self.album_a.refresh_from_db()
        self.assertFalse(self.album_a.is_share_active)

        # Public access with revoked token returns 410 Gone
        revoked_res = client_api.get(public_url)
        self.assertEqual(revoked_res.status_code, status.HTTP_410_GONE)

        # Expired token test
        self.album_a.share_revoked_at = None
        self.album_a.share_expires_at = timezone.now() - timedelta(days=1)
        self.album_a.save()

        expired_res = client_api.get(public_url)
        self.assertEqual(expired_res.status_code, status.HTTP_410_GONE)

    def test_prepared_archive_download_and_safe_content_disposition(self):
        """Admin can upload prepared ZIP archives for Download All; clients get presigned URLs with safe Content-Disposition."""
        # Create ready media archive
        archive_item = Media.objects.create(
            album=self.album_a,
            object_key=f"albums/{self.album_a.id}/archives/wedding_part1.zip",
            original_filename="Wedding Photos Part 1.zip",
            byte_size=5368709120,  # 5 GB
            is_archive=True,
            archive_part_number=1,
            upload_status='ready'
        )

        # Create active share token
        raw_token = generate_download_token()
        self.album_a.share_token_hash = hash_download_token(raw_token)
        self.album_a.share_expires_at = timezone.now() + timedelta(days=7)
        self.album_a.save()

        # Client requests album view
        client_api = APIClient()
        pub_url = reverse('client_album_view', kwargs={'share_token': raw_token})
        res = client_api.get(pub_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']['archives']), 1)
        self.assertEqual(res.data['results']['archives'][0]['part_number'], 1)
        self.assertEqual(res.data['results']['archives'][0]['byte_size'], 5368709120)

        # Client requests download URL
        dl_url = reverse('client_album_media_download', kwargs={
            'share_token': raw_token,
            'media_id': archive_item.id
        })
        dl_res = client_api.get(dl_url)
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertIn('download_url', dl_res.data)
        # Check safe Content-Disposition parameter in presigned URL
        self.assertIn('response-content-disposition', dl_res.data['download_url'].lower())
        self.assertIn('attachment', dl_res.data['download_url'].lower())

    def test_cleanup_abandoned_uploads_command(self):
        """Scheduled command cleans expired upload sessions and aborts S3 multipart parts."""
        from django.core.management import call_command
        from io import StringIO

        # Create an abandoned session older than threshold
        old_media = Media.objects.create(
            album=self.album_a,
            object_key=f"albums/{self.album_a.id}/abandoned.mp4",
            original_filename="abandoned.mp4",
            upload_status='uploading'
        )
        old_session = UploadSession.objects.create(
            owner=self.admin,
            media=old_media,
            object_key=old_media.object_key,
            multipart_upload_id="orphaned-upload-999",
            state='uploading',
            expires_at=timezone.now() - timedelta(hours=1)
        )

        with patch('apps.photos.services.s3_storage.abort_multipart_upload_server', return_value=True) as mock_abort:
            out = StringIO()
            call_command('cleanup_abandoned_uploads', hours=0, stdout=out)
            output = out.getvalue()

            mock_abort.assert_called_once_with(old_media.object_key, "orphaned-upload-999")
            old_session.refresh_from_db()
            self.assertEqual(old_session.state, 'expired')
            self.assertIn("Aborted 1 multipart uploads", output)

