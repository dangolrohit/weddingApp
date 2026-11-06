from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.site_settings.models import SiteSetting

class SiteSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            email="admin@studio.com",
            name="Admin",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_get_all_settings(self):
        url = reverse('admin_settings')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('watermark', response.data)
        self.assertIn('branding', response.data)
        self.assertIn('delivery', response.data)
        self.assertIn('email', response.data)

    def test_update_settings(self):
        url = reverse('admin_settings')
        payload = {
            'branding': {
                'studio_name': 'Everlasting Memories Photography',
                'phone': '+1 555 987 6543'
            },
            'delivery': {
                'link_valid_days': 10
            }
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['branding']['studio_name'], 'Everlasting Memories Photography')
        self.assertEqual(response.data['branding']['phone'], '+1 555 987 6543')
        self.assertEqual(response.data['delivery']['link_valid_days'], 10)
        # Verify defaults preserved for untouched keys
        self.assertEqual(response.data['delivery']['max_downloads'], 10)

