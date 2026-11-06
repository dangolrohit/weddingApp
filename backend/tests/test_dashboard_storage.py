from pathlib import Path
from django.test import TestCase
from django.urls import reverse
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.delivery.models import DownloadLink, ZipBundle

class DashboardAndStorageTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@dashboard.com",
            name="Studio Manager",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.admin)

        self.category = Category.objects.create(name="Reception", slug="reception")
        self.test_client = Client.objects.create(
            groom_name="Lucas",
            bride_name="Emma",
            category=self.category,
            status="published",
            created_by=self.admin
        )

        for i in range(4):
            Photo.objects.create(
                client=self.test_client,
                original_filename=f"lucas_{i}.jpg",
                storage_key=f"originals/{self.test_client.id}/lucas_{i}.jpg",
                size_bytes=1024 * 1024,
                status='ready'
            )

    def test_admin_dashboard_metrics(self):
        url = reverse('admin_dashboard')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_clients'], 1)
        self.assertEqual(response.data['total_photos'], 4)
        self.assertIn('storage', response.data)
        self.assertIn('pending_work', response.data)
        self.assertIn('download_links', response.data)
        self.assertIn('recent_clients', response.data)
        self.assertIn('chart', response.data)
        self.assertEqual(len(response.data['recent_clients']), 1)

    def test_admin_storage_overview(self):
        url = reverse('admin_storage_overview')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('system_disk', response.data)
        self.assertIn('breakdown', response.data)
        self.assertIn('client_usage', response.data)
        self.assertEqual(len(response.data['client_usage']), 1)
        self.assertEqual(response.data['client_usage'][0]['id'], str(self.test_client.id))

    def test_admin_storage_recalculate(self):
        url = reverse('admin_storage_recalculate')
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('result', response.data)
        self.assertGreaterEqual(response.data['result']['clients_updated'], 1)

    def test_admin_storage_clear_zips(self):
        # Create a dummy bundle
        bundle = ZipBundle.objects.create(
            client=self.test_client,
            status='ready'
        )

        url = reverse('admin_storage_clear_zips')
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('reclaimed_bytes', response.data)
        self.assertEqual(response.data['cleared_bundles'], 1)

