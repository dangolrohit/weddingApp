from rest_framework import serializers
from apps.photos.models import Photo
from .models import DownloadLink

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
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, trim_whitespace=True, default='')
    groom_name = serializers.CharField(max_length=255, required=False, allow_blank=True, trim_whitespace=True, default='')
    bride_name = serializers.CharField(max_length=255, required=False, allow_blank=True, trim_whitespace=True, default='')
    passkey = serializers.CharField(max_length=64, required=True, trim_whitespace=True)

    def validate(self, attrs):
        if not attrs.get('name') and not attrs.get('groom_name') and not attrs.get('bride_name'):
            raise serializers.ValidationError({'name': 'Please enter your client or event name.'})
        return attrs

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


class AdminSendLinkSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    save_email = serializers.BooleanField(default=False)
    revoke_previous = serializers.BooleanField(default=True)


class AdminDownloadLinkSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = DownloadLink
        fields = [
            'id',
            'email',
            'expires_at',
            'revoked_at',
            'max_downloads',
            'download_count',
            'created_by_name',
            'sent_at',
            'is_active',
            'created_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.email
        return 'Client Self-Request'
