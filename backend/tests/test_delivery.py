from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.delivery.models import AccessAttempt, DownloadLink
from apps.core.utils import generate_passkey, sign_client_session

class GetMyImagePhase5Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.com",
            name="Admin",
            password="Password123!"
        )

        self.raw_passkey = "K7M2-9QXA"
        self.wedding_client = Client.objects.create(
            groom_name="Arthur Pendragon",
            bride_name="Guinevere",
            status="published",
            created_by=self.admin
        )
        self.wedding_client.set_passkey(self.raw_passkey)
        self.wedding_client.save()

        # Add sample ready photos
        for i in range(5):
            Photo.objects.create(
                client=self.wedding_client,
                original_filename=f"photo_{i}.jpg",
                storage_key=f"originals/{self.wedding_client.id}/photo_{i}.jpg",
                status='ready'
            )

    def test_client_verification_success(self):
        url = reverse('client_verify')
        # Reverse name order and mixed casing to verify resilient normalization
        payload = {
            'groom_name': 'guinevere',
            'bride_name': 'arthur pendragon',
            'passkey': 'k7m2-9qxa'
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('session_token', response.data)
        self.assertEqual(response.data['client']['id'], self.wedding_client.id)
        self.assertEqual(response.data['client']['photo_count'], 5)

        # Access attempt logged
        self.assertTrue(AccessAttempt.objects.filter(client=self.wedding_client, success=True).exists())

    def test_client_verification_wrong_passkey(self):
        url = reverse('client_verify')
        payload = {
            'groom_name': 'Arthur Pendragon',
            'bride_name': 'Guinevere',
            'passkey': 'WRONG-PASSKEY'
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AccessAttempt.objects.filter(client=self.wedding_client, success=False).exists())

    def test_client_verification_rate_limiting(self):
        url = reverse('client_verify')
        # Simulate 5 failed attempts from same IP
        for _ in range(5):
            AccessAttempt.objects.create(
                ip_address='127.0.0.1',
                client=self.wedding_client,
                success=False
            )

        payload = {
            'groom_name': 'Arthur Pendragon',
            'bride_name': 'Guinevere',
            'passkey': self.raw_passkey
        }
        # 6th attempt should be blocked with 429
        response = self.client.post(url, payload, format='json', REMOTE_ADDR='127.0.0.1')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_client_photos_preview(self):
        token = sign_client_session(str(self.wedding_client.id))
        url = reverse('client_photos_preview')

        # 1. Without session token -> 401
        res_unauth = self.client.get(url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. With valid session token -> 200 with photos
        res_auth = self.client.get(url, HTTP_X_CLIENT_SESSION=token)
        self.assertEqual(res_auth.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_auth.data['results']), 5)
        self.assertTrue(res_auth.data['results'][0]['preview_url'].startswith('/files/preview/'))

    def test_client_request_link_locks_email(self):
        token = sign_client_session(str(self.wedding_client.id))
        url = reverse('client_request_link')

        # 1. First submission locks the email
        payload = {'email': 'arthur@camelot.co.uk'}
        res1 = self.client.post(url, payload, format='json', HTTP_X_CLIENT_SESSION=token)

        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.wedding_client.refresh_from_db()
        self.assertEqual(self.wedding_client.linked_email, 'arthur@camelot.co.uk')
        self.assertTrue(self.wedding_client.email_locked)

        # Check link created
        link = DownloadLink.objects.filter(client=self.wedding_client).first()
        self.assertIsNotNone(link)
        self.assertEqual(link.email, 'arthur@camelot.co.uk')

        # 2. Subsequent submission ignores a different email and sends to the locked email
        payload2 = {'email': 'intruder@hack.com'}
        res2 = self.client.post(url, payload2, format='json', HTTP_X_CLIENT_SESSION=token)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.wedding_client.refresh_from_db()
        # Email remained locked to original!
        self.assertEqual(self.wedding_client.linked_email, 'arthur@camelot.co.uk')

