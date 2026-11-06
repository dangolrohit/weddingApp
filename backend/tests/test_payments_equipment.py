from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.clients.models import Client
from apps.payments.models import Payment
from apps.equipment.models import Equipment

class PaymentsEquipmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            email="admin@studio.com",
            name="Studio Admin",
            password="AdminPassword123!"
        )
        self.client.force_authenticate(user=self.user)

        self.wedding_client = Client.objects.create(
            groom_name="Aarav",
            bride_name="Ananya",
            event_date="2026-12-25",
            package_price=50000.00,
            status="published",
            created_by=self.user
        )

    def test_record_advance_payment_cash(self):
        url = reverse('admin_payment_list_create')
        data = {
            'client': str(self.wedding_client.id),
            'amount': '15000.00',
            'method': 'cash',
            'payment_type': 'advance',
            'payment_date': '2026-11-01',
            'reference_no': 'RCPT-001',
            'notes': 'Advance booking deposit paid in cash'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['method'], 'cash')
        self.assertEqual(response.data['payment_type'], 'advance')
        self.assertEqual(response.data['amount'], '15000.00')
        self.assertEqual(Payment.objects.count(), 1)

    def test_record_partial_payment_online(self):
        url = reverse('admin_payment_list_create')
        data = {
            'client': str(self.wedding_client.id),
            'amount': '20000.00',
            'method': 'online',
            'payment_type': 'partial',
            'payment_date': '2026-11-05',
            'reference_no': 'TXN987654321',
            'notes': 'Online bank wire transfer'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['method'], 'online')
        self.assertEqual(response.data['payment_type'], 'partial')

    def test_invalid_payment_amount(self):
        url = reverse('admin_payment_list_create')
        data = {
            'client': str(self.wedding_client.id),
            'amount': '-500.00',
            'method': 'cash',
            'payment_type': 'advance'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_payments_and_balance(self):
        # Create advance and partial payments
        Payment.objects.create(
            client=self.wedding_client,
            amount=15000.00,
            method='cash',
            payment_type='advance',
            payment_date='2026-11-01',
            recorded_by=self.user
        )
        Payment.objects.create(
            client=self.wedding_client,
            amount=20000.00,
            method='upi',
            payment_type='partial',
            payment_date='2026-11-05',
            recorded_by=self.user
        )

        url = reverse('admin_client_payments', kwargs={'client_pk': self.wedding_client.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_paid'], 35000.0)
        self.assertEqual(response.data['package_price'], 50000.0)
        self.assertEqual(response.data['pending_balance'], 15000.0)
        self.assertEqual(response.data['payment_status'], 'partial')
        self.assertEqual(len(response.data['payments']), 2)

    def test_payment_summary_api(self):
        Payment.objects.create(
            client=self.wedding_client,
            amount=10000.00,
            method='cash',
            payment_type='advance',
            payment_date='2026-11-01',
            recorded_by=self.user
        )
        Payment.objects.create(
            client=self.wedding_client,
            amount=15000.00,
            method='online',
            payment_type='partial',
            payment_date='2026-11-05',
            recorded_by=self.user
        )

        url = reverse('admin_payment_summary')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_collected'], 25000.0)
        self.assertEqual(response.data['total_cash'], 10000.0)
        self.assertEqual(response.data['total_online'], 15000.0)
        self.assertEqual(response.data['advance_collected'], 10000.0)
        self.assertEqual(response.data['total_transactions'], 2)

    def test_equipment_crud(self):
        list_url = reverse('admin_equipment_list_create')
        eq_data = {
            'name': 'Sony Alpha A7 IV',
            'category': 'camera',
            'brand': 'Sony',
            'model_number': 'ILCE-7M4',
            'serial_number': 'SN789456123',
            'purchase_date': '2025-06-15',
            'purchase_price': '2500.00',
            'status': 'available',
            'notes': 'Primary wedding body with dual CFexpress slots'
        }
        res_create = self.client.post(list_url, eq_data, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        eq_id = res_create.data['id']
        self.assertEqual(Equipment.objects.count(), 1)

        detail_url = reverse('admin_equipment_detail', kwargs={'pk': eq_id})
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data['name'], 'Sony Alpha A7 IV')
        self.assertEqual(res_get.data['status_display'], 'Available / Ready')

        # Update status
        res_patch = self.client.patch(detail_url, {'status': 'in_use', 'assigned_to': 'Lead Cam 1'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['status'], 'in_use')
        self.assertEqual(res_patch.data['assigned_to'], 'Lead Cam 1')

        # Summary
        summary_url = reverse('admin_equipment_summary')
        res_summary = self.client.get(summary_url)
        self.assertEqual(res_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(res_summary.data['total_count'], 1)
        self.assertEqual(res_summary.data['in_use_count'], 1)

        # Delete
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Equipment.objects.count(), 0)

    def test_unauthenticated_access_denied(self):
        self.client.logout()
        res = self.client.get(reverse('admin_payment_list_create'))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res_eq = self.client.get(reverse('admin_equipment_list_create'))
        self.assertEqual(res_eq.status_code, status.HTTP_401_UNAUTHORIZED)
