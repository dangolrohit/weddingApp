import io
from pathlib import Path
from PIL import Image
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo, PhotoVariant
from apps.photos.tasks import process_photo_task

def create_test_image(width=800, height=600, color='blue', format='JPEG'):
    file_io = io.BytesIO()
    img = Image.new('RGB', (width, height), color=color)
    img.save(file_io, format=format)
    file_io.seek(0)
    return file_io

class PhotoPipelineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@studio.com",
            name="Admin",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.admin)

        self.category = Category.objects.create(name="Wedding")
        self.wedding_client = Client.objects.create(
            groom_name="Robert",
            bride_name="Sophia",
            category=self.category,
            status="published",
            created_by=self.admin
        )

    def test_upload_photo(self):
        url = reverse('admin_client_photos', kwargs={'client_id': self.wedding_client.id})
        img_bytes = create_test_image(1200, 800)
        upload_file = SimpleUploadedFile("ceremony_01.jpg", img_bytes.read(), content_type="image/jpeg")

        response = self.client.post(url, {'file': upload_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 1)
        photo_id = response.data[0]['id']

        photo = Photo.objects.get(id=photo_id)
        self.assertEqual(photo.original_filename, "ceremony_01.jpg")
        self.assertTrue(photo.storage_key.startswith(f"originals/{self.wedding_client.id}/"))

        # Process photo synchronously to test variant generation
        process_photo_task(str(photo.id))
        photo.refresh_from_db()
        self.assertEqual(photo.status, 'ready')
        self.assertEqual(photo.width, 1200)
        self.assertEqual(photo.height, 800)

        # Check variants created
        self.assertTrue(photo.variants.filter(kind='thumb').exists())
        self.assertTrue(photo.variants.filter(kind='preview').exists())

    def test_showcase_limit_of_three(self):
        # Create 4 photos for client
        photos = []
        for i in range(4):
            p = Photo.objects.create(
                client=self.wedding_client,
                original_filename=f"p_{i}.jpg",
                storage_key=f"originals/{self.wedding_client.id}/p_{i}.jpg",
                status='ready'
            )
            photos.append(p)

        url = reverse('admin_client_showcase', kwargs={'client_id': self.wedding_client.id})

        # Set 3 photos as showcase
        response = self.client.put(url, {
            'photo_ids': [str(photos[0].id), str(photos[1].id), str(photos[2].id)]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.wedding_client.photos.filter(showcase_order__isnull=False).count(), 3)

        # Attempting more than 3 in payload fails validation
        fail_response = self.client.put(url, {
            'photo_ids': [str(p.id) for p in photos] # 4 photos
        }, format='json')
        self.assertEqual(fail_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_protected_file_serving_permissions(self):
        photo = Photo.objects.create(
            client=self.wedding_client,
            original_filename="test.jpg",
            storage_key=f"originals/{self.wedding_client.id}/test.jpg",
            status='ready'
        )
        process_photo_task(str(photo.id))

        thumb_url = reverse('protected_file_serve', kwargs={'kind': 'thumb', 'file_id': photo.id})
        orig_url = reverse('protected_file_serve', kwargs={'kind': 'original', 'file_id': photo.id})

        # 1. Admin can access thumbnail
        admin_res = self.client.get(thumb_url)
        self.assertIn(admin_res.status_code, (status.HTTP_200_OK, status.HTTP_200_OK))

        # 2. Original is NEVER served directly
        orig_res = self.client.get(orig_url)
        self.assertEqual(orig_res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Unauthenticated public cannot access thumbnail
        self.client.credentials() # Logout
        anon_res = self.client.get(thumb_url)
        self.assertEqual(anon_res.status_code, status.HTTP_403_FORBIDDEN)
