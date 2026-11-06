import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone

class Payment(models.Model):
    METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('online', 'Online / Bank Transfer'),
        ('upi', 'UPI / QR Code'),
        ('card', 'Credit / Debit Card'),
        ('cheque', 'Cheque'),
        ('other', 'Other'),
    )

    TYPE_CHOICES = (
        ('advance', 'Advance / Booking Deposit'),
        ('partial', 'Partial Payment'),
        ('installment', 'Installment'),
        ('final', 'Final Settlement'),
        ('full', 'Full Payment'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='payments',
        db_index=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    payment_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='advance')
    payment_date = models.DateField(default=timezone.now)
    reference_no = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        help_text="Transaction ID, Cheque #, or Receipt Ref"
    )
    notes = models.TextField(blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['client', 'payment_date'], name='idx_pay_client_date'),
            models.Index(fields=['method'], name='idx_pay_method'),
            models.Index(fields=['payment_type'], name='idx_pay_type'),
        ]
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'

    def __str__(self):
        return f"{self.client} - {self.amount} ({self.get_method_display()})"
