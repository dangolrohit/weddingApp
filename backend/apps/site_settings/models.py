from django.db import models

DEFAULT_SETTINGS = {
    'watermark': {
        'enabled': False,
        'type': 'text',
        'text': 'Wedding Studio',
        'image_key': '',
        'position': 'bottom-right',
        'opacity': 60,
        'scale': 20,
        'apply_to_client_preview': False,
    },
    'branding': {
        'studio_name': 'Wedding Studio',
        'logo_key': '',
        'phone': '',
        'whatsapp': '',
        'email': 'contact@weddingstudio.com',
        'social_links': {
            'instagram': '',
            'facebook': '',
            'youtube': '',
        },
    },
    'delivery': {
        'link_valid_days': 7,
        'max_downloads': 10,
        'zip_part_mb': 1500,
        'revoke_on_send': True,
    },
    'email': {
        'from_name': 'Wedding Studio',
        'from_address': 'notifications@weddingstudio.com',
        'reply_to': 'contact@weddingstudio.com',
    },
}

class SiteSetting(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'site_settings'
        verbose_name = 'Site Setting'
        verbose_name_plural = 'Site Settings'

    def __str__(self):
        return self.key

    @classmethod
    def get_setting(cls, key: str) -> dict:
        """Retrieves setting value by key, merged with defaults."""
        default_val = DEFAULT_SETTINGS.get(key, {})
        try:
            obj = cls.objects.get(key=key)
            if isinstance(obj.value, dict) and isinstance(default_val, dict):
                merged = default_val.copy()
                merged.update(obj.value)
                return merged
            return obj.value
        except cls.DoesNotExist:
            return default_val

    @classmethod
    def get_all_settings(cls) -> dict:
        """Returns all system settings as a dictionary."""
        result = {}
        for k in DEFAULT_SETTINGS.keys():
            result[k] = cls.get_setting(k)
        return result

    @classmethod
    def set_setting(cls, key: str, value: dict):
        """Saves a setting value."""
        obj, _ = cls.objects.get_or_create(key=key)
        obj.value = value
        obj.save()
        return obj
