from rest_framework import serializers
from apps.photos.models import Photo

def mask_email(email: str) -> str:
    """Masks email address for client privacy. Example: alexandra@gmail.com -> a***a@gmail.com"""
    if not email or '@' not in email:
        return ''
    user_part, domain_part = email.split('@', 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + '***'
    else:
        masked_user = user_part[0] + '***' + user_part[-1]
    return f"{masked_user}@{domain_part}"

class ClientVerifySerializer(serializers.Serializer):
    groom_name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    bride_name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    passkey = serializers.CharField(max_length=64, required=True, trim_whitespace=True)

class ClientPreviewPhotoSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            'id',
            'original_filename',
            'width',
            'height',
            'taken_at',
            'sort_order',
            'preview_url',
            'thumb_url',
        ]

    def get_preview_url(self, obj):
        return f"/files/preview/{obj.id}"

    def get_thumb_url(self, obj):
        return f"/files/thumb/{obj.id}"

class ClientLinkRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
