import uuid
from django.db import models
from apps.accounts.models import User
from apps.clients.models import Client

class AccessAttempt(models.Model):
    """Tracks client portal verification attempts for brute force mitigation."""
    id = models.BigAutoField(primary_key=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True, related_name='access_attempts')
    success = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'access_attempts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ip_address', 'created_at']),
            models.Index(fields=['client', 'created_at']),
        ]

    def __str__(self):
        status_str = "Success" if self.success else "Failed"
        return f"{status_str} attempt from {self.ip_address} at {self.created_at}"


class ZipBundle(models.Model):
    """Uncompressed multi-part ZIP bundle created for client download."""
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('building', 'Building'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='zip_bundles')
    status = models.CharField(max_length=32, default='queued', choices=STATUS_CHOICES)
    parts = models.JSONField(default=list)  # [{part: 1, storage_key: '...', size_bytes: 12345, photo_count: 50}]
    photo_count = models.IntegerField(default=0)
    total_bytes = models.BigIntegerField(default=0)
    built_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'zip_bundles'
        ordering = ['-created_at']

    def __str__(self):
        return f"ZIP Bundle ({self.status}) for Client {self.client_id}"


class DownloadLink(models.Model):
    """Cryptographically hashed 7-day download link."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='download_links')
    bundle = models.ForeignKey(ZipBundle, on_delete=models.SET_NULL, null=True, blank=True, related_name='download_links')
    token_hash = models.CharField(max_length=128, unique=True)
    email = models.EmailField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    max_downloads = models.IntegerField(default=10)
    download_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_links')
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'download_links'
        ordering = ['-created_at']

    def __str__(self):
        return f"Link for {self.email} (Expires {self.expires_at.strftime('%Y-%m-%d')})"

    @property
    def is_active(self):
        from django.utils import timezone
        return (self.revoked_at is None) and (self.expires_at > timezone.now()) and (self.download_count < self.max_downloads)


class DownloadLog(models.Model):
    """Audit log for each ZIP part download."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    link = models.ForeignKey(DownloadLink, on_delete=models.CASCADE, related_name='download_logs')
    part_no = models.IntegerField(default=1)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'download_logs'
        ordering = ['-created_at']


class EmailLog(models.Model):
    """Audit log for delivery emails dispatched via SMTP."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='email_logs')
    link = models.ForeignKey(DownloadLink, on_delete=models.SET_NULL, null=True, blank=True, related_name='email_logs')
    to_email = models.EmailField()
    kind = models.CharField(max_length=32, default='link')  # link, reminder, admin_notice
    status = models.CharField(max_length=32, default='queued')  # queued, sent, failed
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']
