from django.test import TestCase
from django.urls import reverse

class HealthCheckTest(TestCase):
    def test_health_check_endpoint(self):
        response = self.client.get(reverse('health_check'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['app'], 'wedding-photo-platform')
        self.assertIn('checks', data)
        self.assertTrue(data['checks']['database'])

