import time
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.core.utils import sign_client_session
from apps.delivery.bundle import build_client_zip_bundle

class LoadAndStressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="stress@studio.com",
            name="Stress Admin",
            password="Password123!"
        )

        self.wedding_client = Client.objects.create(
            groom_name="Mega",
            bride_name="Wedding",
            status="published",
            created_by=self.admin
        )

    def test_thousand_photo_pagination_performance(self):
        # 1. Bulk create 1,000 photos
        t0 = time.time()
        photos_to_create = [
            Photo(
                client=self.wedding_client,
                original_filename=f"IMG_{i:04d}.JPG",
                storage_key=f"originals/{self.wedding_client.id}/IMG_{i:04d}.JPG",
                size_bytes=5 * 1024 * 1024, # 5 MB per photo
                status='ready',
                sort_order=i
            )
            for i in range(1, 1001)
        ]
        Photo.objects.bulk_create(photos_to_create)
        creation_time = time.time() - t0
        self.assertEqual(Photo.objects.filter(client=self.wedding_client).count(), 1000)

        # 2. Benchmark paginated client preview query
        token = sign_client_session(str(self.wedding_client.id))
        url = reverse('client_photos_preview')

        t_req = time.time()
        response = self.client.get(f"{url}?page=1&page_size=50", HTTP_X_CLIENT_SESSION=token)
        req_duration = time.time() - t_req

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 50)
        self.assertEqual(response.data['count'], 1000)
        # Should respond quickly (well under 500ms in memory)
        self.assertLess(req_duration, 1.0)

    def test_large_gallery_zip_part_partitioning(self):
        # 50 photos of 50 MB each = 2,500 MB (~2.5 GB total)
        # With default 1500 MB part size, should cleanly partition into 2 parts
        photos_to_create = [
            Photo(
                client=self.wedding_client,
                original_filename=f"RAW_{i:03d}.JPG",
                storage_key=f"originals/{self.wedding_client.id}/RAW_{i:03d}.JPG",
                size_bytes=50 * 1024 * 1024, # 50 MB
                status='ready',
                sort_order=i
            )
            for i in range(1, 51)
        ]
        Photo.objects.bulk_create(photos_to_create)

        bundle = build_client_zip_bundle(self.wedding_client)

        self.assertEqual(bundle.status, 'ready')
        self.assertEqual(bundle.photo_count, 50)
        # Verify partitioned into 2 parts (since 2.5 GB > 1.5 GB limit)
        self.assertEqual(len(bundle.parts), 2)
        total_photos_in_parts = sum(p['photo_count'] for p in bundle.parts)
        self.assertEqual(total_photos_in_parts, 50)

