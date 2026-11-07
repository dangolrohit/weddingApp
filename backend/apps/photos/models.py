import uuid
from django.db import models
from django.db.models import Q
from django.conf import settings
from django.utils import timezone

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
        return f"{self.original_filename} ({self.client.display_name})"


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


class Album(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='albums',
        db_index=True
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    share_token_hash = models.CharField(max_length=128, blank=True, null=True, unique=True, db_index=True)
    share_expires_at = models.DateTimeField(blank=True, null=True)
    share_revoked_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_albums'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'albums'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'status'], name='idx_albums_client_status'),
            models.Index(fields=['share_token_hash'], name='idx_albums_share_token'),
        ]
        verbose_name = 'Album'
        verbose_name_plural = 'Albums'

    def __str__(self):
        return f"{self.title} ({self.client.display_name})"

    @property
    def is_share_active(self):
        if not self.share_token_hash or self.share_revoked_at is not None:
            return False
        if self.share_expires_at and self.share_expires_at <= timezone.now():
            return False
        return self.status == 'published'


class Media(models.Model):
    MEDIA_TYPE_CHOICES = (
        ('photo', 'Photo'),
        ('video', 'Video'),
        ('archive', 'ZIP Archive'),
        ('other', 'Other Document'),
    )

    UPLOAD_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('uploading', 'Uploading'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    album = models.ForeignKey(
        Album,
        on_delete=models.CASCADE,
        related_name='media_items',
        db_index=True
    )
    object_key = models.CharField(max_length=512, unique=True, db_index=True)
    original_filename = models.CharField(max_length=512)
    content_type = models.CharField(max_length=150, blank=True, default='application/octet-stream')
    byte_size = models.BigIntegerField(default=0)
    preview_key = models.CharField(max_length=512, blank=True, null=True)
    media_type = models.CharField(max_length=20, choices=MEDIA_TYPE_CHOICES, default='photo')
    is_archive = models.BooleanField(default=False)
    archive_part_number = models.IntegerField(blank=True, null=True)
    upload_status = models.CharField(max_length=20, choices=UPLOAD_STATUS_CHOICES, default='pending')
    etag = models.CharField(max_length=100, blank=True, default='')
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'album_media'
        ordering = ['sort_order', 'created_at']
        indexes = [
            models.Index(fields=['album', 'upload_status'], name='idx_media_album_status'),
            models.Index(fields=['album', 'is_archive'], name='idx_media_album_archive'),
        ]
        verbose_name = 'Media'
        verbose_name_plural = 'Media Items'

    def __str__(self):
        return f"{self.original_filename} ({self.album.title})"


class UploadSession(models.Model):
    STATE_CHOICES = (
        ('initiated', 'Initiated'),
        ('uploading', 'Uploading'),
        ('completed', 'Completed'),
        ('aborted', 'Aborted'),
        ('expired', 'Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='upload_sessions'
    )
    media = models.ForeignKey(
        Media,
        on_delete=models.CASCADE,
        related_name='upload_sessions'
    )
    multipart_upload_id = models.CharField(max_length=255, blank=True, null=True)
    object_key = models.CharField(max_length=512, db_index=True)
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default='initiated')
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'upload_sessions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['object_key', 'state'], name='idx_session_key_state'),
            models.Index(fields=['state', 'expires_at'], name='idx_session_state_expiry'),
        ]
        verbose_name = 'Upload Session'
        verbose_name_plural = 'Upload Sessions'

    def __str__(self):
        return f"UploadSession {self.id} for {self.object_key} ({self.state})"

