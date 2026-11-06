from rest_framework import serializers
from .models import Client
from apps.categories.models import Category
from apps.categories.serializers import CategorySerializer
from apps.core.utils import generate_passkey, hash_passkey

class ClientListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    cover_photo = serializers.SerializerMethodField()
    link_status = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            'id', 'groom_name', 'bride_name', 'event_date', 'category',
            'category_name', 'category_slug', 'photo_count', 'storage_bytes',
            'status', 'link_status', 'cover_photo', 'deleted_at', 'created_at'
        )

    def get_cover_photo(self, obj):
        # Once photos app is populated, returns first showcase or first photo thumb
        first_photo = getattr(obj, 'photos', None)
        if first_photo:
            photo = first_photo.filter(is_hidden=False).order_by('showcase_order', 'sort_order').first()
            if photo:
                return f"/files/thumb/{photo.id}"
        return None

    def get_link_status(self, obj):
        # Check active download links for this client
        latest_link = getattr(obj, 'download_links', None)
        if latest_link:
            link = latest_link.filter(revoked_at__isnull=True).order_by('-created_at').first()
            if link:
                from django.utils import timezone
                if link.expires_at > timezone.now():
                    return {'status': 'active', 'expires_at': link.expires_at}
                return {'status': 'expired', 'expires_at': link.expires_at}
        return {'status': 'none', 'expires_at': None}

class ClientDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    link_status = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            'id', 'groom_name', 'bride_name', 'name_key', 'linked_email',
            'email_locked', 'phone', 'event_date', 'category', 'category_id',
            'status', 'notes', 'photo_count', 'storage_bytes', 'link_status',
            'deleted_at', 'created_by', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'name_key', 'photo_count', 'storage_bytes', 'created_at', 'updated_at', 'link_status')

    def get_link_status(self, obj):
        latest_link = getattr(obj, 'download_links', None)
        if latest_link:
            link = latest_link.filter(revoked_at__isnull=True).order_by('-created_at').first()
            if link:
                from django.utils import timezone
                if link.expires_at > timezone.now():
                    return {'status': 'active', 'expires_at': link.expires_at}
                return {'status': 'expired', 'expires_at': link.expires_at}
        return {'status': 'none', 'expires_at': None}

class ClientCreateSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        required=False,
        allow_null=True
    )
    raw_passkey = serializers.CharField(read_only=True)

    class Meta:
        model = Client
        fields = (
            'id', 'groom_name', 'bride_name', 'event_date', 'category_id',
            'phone', 'linked_email', 'notes', 'status', 'raw_passkey'
        )

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user

        # Auto-generate unambiguous passkey
        raw_passkey = generate_passkey()
        client = Client(**validated_data)
        client.set_passkey(raw_passkey)
        client.save()

        # Attach raw_passkey to instance so it is returned once in response
        client.raw_passkey = raw_passkey
        return client
