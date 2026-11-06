import io
from pathlib import Path
from PIL import Image
from django.test import TestCase
from django.urls import reverse
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.photos.tasks import generate_showcase_variant
from apps.public_site.models import Inquiry

def create_test_image(width=800, height=600, color='gold', format='JPEG'):
    file_io = io.BytesIO()
    img = Image.new('RGB', (width, height), color=color)
    img.save(file_io, format=format)
    file_io.seek(0)
    return file_io

class PublicSiteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.com",
            name="Admin",
            password="Password123!"
        )

        # Categories
        self.cat_wedding = Category.objects.create(name="Wedding", slug="wedding", sort_order=1, is_visible=True)
        self.cat_hidden = Category.objects.create(name="Secret", slug="secret", sort_order=2, is_visible=False)

        # Published Client
        self.published_client = Client.objects.create(
            groom_name="Arthur",
            bride_name="Gwen",
            category=self.cat_wedding,
            status="published",
            created_by=self.admin
        )

        # Draft Client (should NOT be visible in public showcase)
        self.draft_client = Client.objects.create(
            groom_name="Lancelot",
            bride_name="Guinevere",
            category=self.cat_wedding,
            status="draft",
            created_by=self.admin
        )

        # Prepare dummy photos for published client
        orig_dir = Path(settings.MEDIA_ROOT) / 'originals' / str(self.published_client.id)
        orig_dir.mkdir(parents=True, exist_ok=True)

        self.photos = []
        for i in range(3):
            img_bytes = create_test_image(800, 600)
            file_path = orig_dir / f"pub_{i}.jpg"
            with open(file_path, 'wb') as f:
                f.write(img_bytes.read())

            p = Photo.objects.create(
                client=self.published_client,
                original_filename=f"pub_{i}.jpg",
                storage_key=f"originals/{self.published_client.id}/pub_{i}.jpg",
                showcase_order=i + 1,
                status='ready'
            )
            generate_showcase_variant(p)
            self.photos.append(p)

    def test_public_categories(self):
        url = reverse('public_categories')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Visible category present, hidden category excluded
        slugs = [c['slug'] for c in response.data]
        self.assertIn("wedding", slugs)
        self.assertNotIn("secret", slugs)

    def test_public_showcase(self):
        url = reverse('public_showcase')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

        first = response.data[0]
        self.assertIn('url', first)
        self.assertTrue(first['url'].startswith('/files/showcase/'))
        self.assertEqual(first['category_slug'], 'wedding')

    def test_public_showcase_category_filter(self):
        url = f"{reverse('public_showcase')}?category=nonexistent"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        url = f"{reverse('public_showcase')}?category=wedding"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_public_showcase_photo_accessible_unauthenticated(self):
        showcase_photo = self.photos[0]
        showcase_file_url = reverse('protected_file_serve', kwargs={'kind': 'showcase', 'file_id': showcase_photo.id})

        # Unauthenticated visitor should be able to fetch the showcase variant
        response = self.client.get(showcase_file_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_public_inquiry_submission(self):
        url = reverse('public_inquiries')
        payload = {
            'name': 'Sarah Connor',
            'email': 'sarah@example.com',
            'phone': '+1 555-0199',
            'message': 'We love your portfolio! Are you available in June?'
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Inquiry.objects.filter(email='sarah@example.com').exists())

    def test_public_inquiry_validation(self):
        url = reverse('public_inquiries')
        # Missing both email and phone should fail
        payload = {
            'name': 'Anonymous',
            'message': 'Hello'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

