import uuid
from django.db import models
from django.conf import settings

class Equipment(models.Model):
    CATEGORY_CHOICES = (
        ('camera', 'Camera Body'),
        ('lens', 'Lens'),
        ('lighting', 'Lighting & Flash'),
        ('audio', 'Audio & Mic'),
        ('drone', 'Drone / Aerial'),
        ('stabilizer', 'Gimbal / Tripod / Rig'),
        ('storage', 'Memory Card / Drive'),
        ('accessory', 'Battery / Filter / Bag'),
        ('other', 'Other Gear'),
    )

    STATUS_CHOICES = (
        ('available', 'Available / Ready'),
        ('in_use', 'In Use / On Shoot'),
        ('maintenance', 'In Maintenance / Repair'),
        ('retired', 'Retired / Backup'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Equipment name or nickname")
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='camera')
    brand = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Sony, Canon, DJI, Godox")
    model_number = models.CharField(max_length=100, blank=True, null=True)
    serial_number = models.CharField(max_length=120, blank=True, null=True)
    purchase_date = models.DateField(blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    assigned_to = models.CharField(max_length=150, blank=True, null=True, help_text="Photographer or team assigned")
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registered_equipment'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'equipment'
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['category'], name='idx_eq_category'),
            models.Index(fields=['status'], name='idx_eq_status'),
            models.Index(fields=['serial_number'], name='idx_eq_serial'),
        ]
        verbose_name = 'Equipment'
        verbose_name_plural = 'Equipment'

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"
