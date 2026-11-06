import uuid
from django.db import models
from apps.accounts.models import User

class BaseModel(models.Model):
    """Abstract base model with UUID primary key and standard timestamps."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ActivityLog(models.Model):
    """System-wide audit activity log for dashboard and operations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    action = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=64, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} by {self.user or 'System'} at {self.created_at}"


def log_activity(action: str, user=None, entity_type: str = '', entity_id=None, metadata: dict = None, ip_address=None):
    """Convenience helper to record system activity log entry."""
    return ActivityLog.objects.create(
        action=action,
        user=user if user and user.is_authenticated else None,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
        ip_address=ip_address
    )
