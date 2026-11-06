from rest_framework import serializers
from .models import Photo, PhotoVariant

class PhotoSerializer(serializers.ModelSerializer):
    thumb_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    showcase_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = (
            'id', 'client_id', 'original_filename', 'size_bytes',
            'width', 'height', 'taken_at', 'status', 'is_hidden',
            'sort_order', 'showcase_order', 'created_at',
            'thumb_url', 'preview_url', 'showcase_url'
        )
        read_only_fields = ('id', 'client_id', 'size_bytes', 'width', 'height', 'taken_at', 'status', 'created_at')

    def get_thumb_url(self, obj):
        return f"/files/thumb/{obj.id}"

    def get_preview_url(self, obj):
        return f"/files/preview/{obj.id}"

    def get_showcase_url(self, obj):
        if obj.showcase_order is not None:
            return f"/files/showcase/{obj.id}"
        return None

class PhotoReorderSerializer(serializers.Serializer):
    photo_orders = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        ),
        help_text="List of items: [{'id': '<uuid>', 'sort_order': 0}, ...]"
    )

class ShowcaseUpdateSerializer(serializers.Serializer):
    photo_ids = serializers.ListField(
        child=serializers.UUIDField(),
        max_length=3,
        help_text="Up to 3 photo IDs to set as showcase in the given order"
    )
