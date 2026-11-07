from rest_framework import serializers
from .models import Album, Media, UploadSession
from .services import s3_storage

class MediaSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = (
            'id', 'album_id', 'original_filename', 'content_type',
            'byte_size', 'preview_key', 'media_type', 'is_archive',
            'archive_part_number', 'upload_status', 'etag',
            'sort_order', 'created_at', 'preview_url', 'download_url'
        )
        read_only_fields = ('id', 'album_id', 'preview_key', 'upload_status', 'etag', 'created_at')

    def get_preview_url(self, obj):
        # If media has preview key, generate a presigned preview URL (valid for 2 hours)
        if obj.preview_key and obj.upload_status == 'ready':
            try:
                return s3_storage.generate_presigned_download_url(
                    obj.preview_key,
                    filename=f"thumb_{obj.original_filename}.webp",
                    expires_in=7200,
                    inline=True
                )
            except Exception:
                return None
        return None

    def get_download_url(self, obj):
        # Download URL is generated on-demand when client clicks download
        return None


class AlbumSerializer(serializers.ModelSerializer):
    client_names = serializers.SerializerMethodField()
    is_share_active = serializers.BooleanField(read_only=True)
    media_count = serializers.SerializerMethodField()
    ready_media_count = serializers.SerializerMethodField()
    total_bytes = serializers.SerializerMethodField()
    archive_count = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = (
            'id', 'client_id', 'client_names', 'title', 'description',
            'status', 'is_share_active', 'share_expires_at', 'share_revoked_at',
            'media_count', 'ready_media_count', 'total_bytes', 'archive_count',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'client_id', 'created_at', 'updated_at')

    def get_client_names(self, obj):
        return f"{obj.client.groom_name} & {obj.client.bride_name}"

    def get_media_count(self, obj):
        return obj.media_items.count()

    def get_ready_media_count(self, obj):
        return obj.media_items.filter(upload_status='ready', is_archive=False).count()

    def get_total_bytes(self, obj):
        from django.db.models import Sum
        result = obj.media_items.filter(upload_status='ready').aggregate(Sum('byte_size'))
        return result['byte_size__sum'] or 0

    def get_archive_count(self, obj):
        return obj.media_items.filter(is_archive=True, upload_status='ready').count()


class PrepareMediaUploadSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=512)
    content_type = serializers.CharField(max_length=150, default='application/octet-stream')
    byte_size = serializers.IntegerField(default=0)
    is_archive = serializers.BooleanField(default=False)
    archive_part_number = serializers.IntegerField(required=False, allow_null=True)


class S3SignSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['PUT', 'POST', 'GET', 'DELETE'])
    key = serializers.CharField(max_length=512)
    uploadId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    partNumber = serializers.IntegerField(required=False, allow_null=True)
    contentType = serializers.CharField(required=False, allow_blank=True, allow_null=True)

