import uuid
from django.db import models

class Inquiry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    event_date = models.DateField(null=True, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=32, default='new')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inquiries'
        ordering = ['-created_at']
        verbose_name = 'Inquiry'
        verbose_name_plural = 'Inquiries'

    def __str__(self):
        return f"Inquiry from {self.name or self.email or 'Anonymous'} ({self.created_at.strftime('%Y-%m-%d')})"

