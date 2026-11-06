import uuid
from django.db import models
from django.db.models import Q

class Photo(models.Model):
    STATUS_CHOICES = (
        ('uploading', 'Uploading'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    )

    SHOWCASE_CHOICES = (
        (1, 'First Showcase'),
        (2, 'Second Showcase'),
        (3, 'Third Showcase'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='photos',
        db_index=True
    )
    original_filename = models.CharField(max_length=512)
    storage_key = models.CharField(max_length=512)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    size_bytes = models.BigIntegerField(default=0)
    width = models.IntegerField(blank=True, null=True)
    height = models.IntegerField(blank=True, null=True)
    taken_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='processing')
    is_hidden = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    showcase_order = models.SmallIntegerField(
        blank=True,
        null=True,
        choices=SHOWCASE_CHOICES,
        help_text="Showcase order 1 to 3. NULL = not public"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'photos'
        ordering = ['sort_order', 'created_at']
        indexes = [
            models.Index(fields=['client', 'sort_order'], name='idx_photos_client'),
            models.Index(fields=['status'], name='idx_photos_status'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['client', 'showcase_order'],
                condition=Q(showcase_order__isnull=False),
                name='uq_photos_showcase'
            )
        ]
        verbose_name = 'Photo'
        verbose_name_plural = 'Photos'

    def __str__(self):
        return f"{self.original_filename} ({self.client.groom_name} & {self.client.bride_name})"


class PhotoVariant(models.Model):
    KIND_CHOICES = (
        ('thumb', 'Thumbnail (400px)'),
        ('preview', 'Preview (1600px)'),
        ('showcase', 'Showcase (1600px Watermarked)'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey(
        Photo,
        on_delete=models.CASCADE,
        related_name='variants',
        db_index=True
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    storage_key = models.CharField(max_length=512)
    width = models.IntegerField(blank=True, null=True)
    height = models.IntegerField(blank=True, null=True)
    size_bytes = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'photo_variants'
        constraints = [
            models.UniqueConstraint(
                fields=['photo', 'kind'],
                name='uq_photo_variant_kind'
            )
        ]
        verbose_name = 'Photo Variant'
        verbose_name_plural = 'Photo Variants'

    def __str__(self):
        return f"{self.kind} - {self.photo.original_filename}"
