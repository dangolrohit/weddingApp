from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.core.utils import normalize_name_key

class ClientTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            email="admin@studio.com",
            name="Admin",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name="Pre-wedding")

    def test_name_key_normalization(self):
        key1 = normalize_name_key("Groom: John Doe", "Bride: Jane Smith")
        key2 = normalize_name_key("Jane Smith", "John Doe")
        self.assertEqual(key1, key2)
        self.assertIn("doe", key1)
        self.assertIn("jane", key1)
        self.assertIn("john", key1)
        self.assertIn("smith", key1)

    def test_create_client_generates_passkey_and_name_key(self):
        url = reverse('admin_client_list_create')
        payload = {
            'groom_name': 'David Miller',
            'bride_name': 'Emily Watson',
            'category_id': str(self.category.id),
            'event_date': '2026-10-15',
            'phone': '+1234567890',
            'linked_email': 'emily@example.com',
            'status': 'published'
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('raw_passkey', response.data)
        raw_passkey = response.data['raw_passkey']
        self.assertRegex(raw_passkey, r'^[A-Z0-9]{4}-[A-Z0-9]{4}$')

        client = Client.objects.get(id=response.data['id'])
        self.assertTrue(client.check_passkey(raw_passkey))
        self.assertFalse(client.check_passkey("WRONG-KEY"))
        self.assertEqual(client.name_key, normalize_name_key('David Miller', 'Emily Watson'))

    def test_passkey_regeneration(self):
        client = Client.objects.create(
            groom_name='David',
            bride_name='Emily',
            created_by=self.user
        )
        old_passkey = "AAAA-1111"
        client.set_passkey(old_passkey)
        client.save()

        url = reverse('admin_client_regenerate_passkey', kwargs={'pk': client.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_passkey = response.data['raw_passkey']
        self.assertNotEqual(old_passkey, new_passkey)

        client.refresh_from_db()
        self.assertTrue(client.check_passkey(new_passkey))
        self.assertFalse(client.check_passkey(old_passkey))

    def test_soft_delete_and_restore(self):
        client = Client.objects.create(
            groom_name='Mark',
            bride_name='Sarah',
            created_by=self.user
        )

        # Soft delete
        del_url = reverse('admin_client_detail', kwargs={'pk': client.id})
        response = self.client.delete(del_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        client.refresh_from_db()
        self.assertTrue(client.is_deleted)

        # List should not include soft-deleted client by default
        list_url = reverse('admin_client_list_create')
        list_res = self.client.get(list_url)
        self.assertEqual(list_res.data['count'], 0)

        # Trash list should include it
        trash_res = self.client.get(f"{list_url}?trash=true")
        self.assertEqual(trash_res.data['count'], 1)

        # Restore
        restore_url = reverse('admin_client_restore', kwargs={'pk': client.id})
        res_response = self.client.post(restore_url)
        self.assertEqual(res_response.status_code, status.HTTP_200_OK)

        client.refresh_from_db()
        self.assertFalse(client.is_deleted)

    def test_create_event_client_without_partner(self):
        """Test creating non-wedding client (e.g. corporate or solo) without bride_name."""
        url = reverse('admin_client_list_create')
        payload = {
            'groom_name': 'TechCorp Annual Gala 2026',
            'bride_name': '',
            'status': 'published'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        raw_passkey = response.data['raw_passkey']

        client = Client.objects.get(id=response.data['id'])
        self.assertEqual(client.display_name, 'TechCorp Annual Gala 2026')
        self.assertEqual(client.bride_name, '')

        # Check default album auto-provisioned
        album = client.albums.first()
        self.assertIsNotNone(album)
        self.assertEqual(album.title, 'TechCorp Annual Gala 2026 Album')

        # Test Client Login Verification using single name
        verify_url = reverse('client_verify')
        verify_res = self.client.post(verify_url, {
            'name': 'TechCorp Annual Gala 2026',
            'passkey': raw_passkey
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data['client']['display_name'], 'TechCorp Annual Gala 2026')


