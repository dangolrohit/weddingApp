from rest_framework import serializers
from apps.categories.models import Category
from apps.photos.models import Photo
from .models import Inquiry

class PublicCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'sort_order']

class PublicShowcasePhotoSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    category_slug = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            'id',
            'client_id',
            'category_name',
            'category_slug',
            'showcase_order',
            'width',
            'height',
            'url',
        ]

    def get_category_name(self, obj):
        return obj.client.category.name if obj.client and obj.client.category else None

    def get_category_slug(self, obj):
        return obj.client.category.slug if obj.client and obj.client.category else None

    def get_url(self, obj):
        return f"/files/showcase/{obj.id}"

class InquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = ['id', 'name', 'email', 'phone', 'event_date', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        if not attrs.get('email') and not attrs.get('phone'):
            raise serializers.ValidationError("Please provide either an email address or a phone number.")
        return attrs
