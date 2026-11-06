import pytest
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User

class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_email = "admin@weddingstudio.com"
        self.admin_password = "AdminSecurePassword123!"
        self.admin_name = "Studio Admin"

        self.user = User.objects.create_superuser(
            email=self.admin_email,
            name=self.admin_name,
            password=self.admin_password
        )

    def test_login_success(self):
        url = reverse('auth_login')
        response = self.client.post(url, {
            'email': self.admin_email,
            'password': self.admin_password
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], self.admin_email)
        self.assertEqual(response.data['user']['name'], self.admin_name)

    def test_login_invalid_password(self):
        url = reverse('auth_login')
        response = self.client.post(url, {
            'email': self.admin_email,
            'password': 'WrongPassword999!'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('access', response.data)

    def test_auth_me_authenticated(self):
        # Login to get token
        login_url = reverse('auth_login')
        login_res = self.client.post(login_url, {
            'email': self.admin_email,
            'password': self.admin_password
        }, format='json')
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = reverse('auth_me')
        response = self.client.get(me_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.admin_email)

    def test_auth_me_unauthenticated(self):
        me_url = reverse('auth_me')
        response = self.client.get(me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change(self):
        login_url = reverse('auth_login')
        login_res = self.client.post(login_url, {
            'email': self.admin_email,
            'password': self.admin_password
        }, format='json')
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        pwd_url = reverse('admin_password_change')

        new_password = "NewStrongPassword456!"
        response = self.client.post(pwd_url, {
            'old_password': self.admin_password,
            'new_password': new_password
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify old password fails and new password succeeds
        self.client.credentials() # clear header
        fail_login = self.client.post(login_url, {
            'email': self.admin_email,
            'password': self.admin_password
        }, format='json')
        self.assertEqual(fail_login.status_code, status.HTTP_400_BAD_REQUEST)

        success_login = self.client.post(login_url, {
            'email': self.admin_email,
            'password': new_password
        }, format='json')
        self.assertEqual(success_login.status_code, status.HTTP_200_OK)

