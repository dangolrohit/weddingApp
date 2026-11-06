from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client

class CategoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            email="admin@studio.com",
            name="Admin",
            password="Password123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_category(self):
        url = reverse('admin_category_list')
        response = self.client.post(url, {
            'name': 'Wedding',
            'sort_order': 1,
            'is_visible': True
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Wedding')
        self.assertEqual(response.data['slug'], 'wedding')

    def test_delete_category_with_assigned_client_fails(self):
        cat = Category.objects.create(name='Haldi')
        # Create active client in this category
        Client.objects.create(
            groom_name='Alex',
            bride_name='Beth',
            category=cat,
            created_by=self.user
        )

        url = reverse('admin_category_detail', kwargs={'pk': cat.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot delete category', response.data['detail'])

    def test_delete_category_empty_succeeds(self):
        cat = Category.objects.create(name='Reception')
        url = reverse('admin_category_detail', kwargs={'pk': cat.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=cat.id).exists())
