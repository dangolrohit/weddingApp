import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.utils import normalize_name_key, hash_passkey, verify_passkey

class Client(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    groom_name = models.CharField(max_length=255)
    bride_name = models.CharField(max_length=255)
    name_key = models.CharField(max_length=512, db_index=True)
    passkey_hash = models.CharField(max_length=255)
    linked_email = models.EmailField(blank=True, null=True)
    email_locked = models.BooleanField(default=False)
    phone = models.CharField(max_length=50, blank=True, null=True)
    event_date = models.DateField(blank=True, null=True)
    category = models.ForeignKey(
        'categories.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clients',
        db_index=True
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, null=True)
    photo_count = models.IntegerField(default=0)
    storage_bytes = models.BigIntegerField(default=0)
    deleted_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'clients'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['name_key'], name='idx_clients_name_key'),
            models.Index(fields=['category'], name='idx_clients_category'),
            models.Index(fields=['status'], name='idx_clients_status'),
            models.Index(fields=['deleted_at'], name='idx_clients_deleted_at'),
        ]
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'

    def save(self, *args, **kwargs):
        # Always maintain normalized name_key
        self.name_key = normalize_name_key(self.groom_name, self.bride_name)
        super().save(*args, **kwargs)

    def set_passkey(self, raw_passkey: str):
        self.passkey_hash = hash_passkey(raw_passkey)

    def check_passkey(self, raw_passkey: str) -> bool:
        return verify_passkey(raw_passkey, self.passkey_hash)

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at', 'updated_at'])

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=['deleted_at', 'updated_at'])

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def __str__(self):
        return f"{self.groom_name} & {self.bride_name}"

