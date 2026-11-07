import os
import logging
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Sum, F
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from apps.clients.models import Client
from apps.core.utils import generate_download_token, hash_download_token
from .models import Album, Media, UploadSession
from .serializers_s3 import (
    AlbumSerializer,
    MediaSerializer,
    PrepareMediaUploadSerializer,
    S3SignSerializer,
)
from .services import s3_storage

logger = logging.getLogger(__name__)


class StandardMediaPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 100


# ----------------------------------------------------------------------
# Admin Album Management Views
# ----------------------------------------------------------------------

class ClientAlbumListCreateView(APIView):
    """
    GET: List all albums for a client.
    POST: Create a new album for a client.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, client_id):
        client = get_object_or_404(Client, id=client_id, deleted_at__isnull=True)
        albums = client.albums.all().order_by('-created_at')
        serializer = AlbumSerializer(albums, many=True)
        return Response(serializer.data)

    def post(self, request, client_id):
        client = get_object_or_404(Client, id=client_id, deleted_at__isnull=True)
        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        if not title:
            return Response({'title': ['Title is required.']}, status=status.HTTP_400_BAD_REQUEST)

        album = Album.objects.create(
            client=client,
            title=title,
            description=description,
            status='draft',
            created_by=request.user
        )
        serializer = AlbumSerializer(album)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminAlbumDetailView(APIView):
    """
    GET: Get album metadata.
    PATCH: Update title, description, or published status.
    DELETE: Delete album and its S3 contents.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        serializer = AlbumSerializer(album)
        return Response(serializer.data)

    def patch(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        title = request.data.get('title')
        description = request.data.get('description')
        album_status = request.data.get('status')

        if title is not None:
            title = title.strip()
            if not title:
                return Response({'title': ['Title cannot be empty.']}, status=status.HTTP_400_BAD_REQUEST)
            album.title = title

        if description is not None:
            album.description = description.strip()

        if album_status is not None:
            if album_status not in dict(Album.STATUS_CHOICES):
                return Response({'status': ['Invalid status choice.']}, status=status.HTTP_400_BAD_REQUEST)
            album.status = album_status

        album.save()
        return Response(AlbumSerializer(album).data)

    def delete(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        # Clean up all S3 objects asynchronously or in-place
        media_items = list(album.media_items.all())
        total_freed_bytes = 0
        for item in media_items:
            s3_storage.delete_object_server(item.object_key)
            if item.preview_key:
                s3_storage.delete_object_server(item.preview_key)
            total_freed_bytes += item.byte_size

        # Decrement client storage bytes
        if total_freed_bytes > 0:
            client = album.client
            client.storage_bytes = max(0, client.storage_bytes - total_freed_bytes)
            client.save(update_fields=['storage_bytes'])

        album.delete()
        return Response({'detail': 'Album and associated storage deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


class AlbumShareLinkView(APIView):
    """
    POST: Generate or regenerate a private, high-entropy, expiring share link for an album.
    Returns the raw share_token (once) and public share_url.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        days = int(request.data.get('expires_in_days', 30))
        if days < 1 or days > 365:
            days = 30

        raw_token = generate_download_token()
        token_hash = hash_download_token(raw_token)

        album.share_token_hash = token_hash
        album.share_expires_at = timezone.now() + timedelta(days=days)
        album.share_revoked_at = None
        album.save(update_fields=['share_token_hash', 'share_expires_at', 'share_revoked_at'])

        return Response({
            'share_token': raw_token,
            'share_url': f"/album/{raw_token}",
            'expires_at': album.share_expires_at.isoformat(),
            'message': 'Share link generated successfully.'
        })


class AlbumRevokeShareView(APIView):
    """
    POST: Revoke client share access immediately.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        album.share_revoked_at = timezone.now()
        album.save(update_fields=['share_revoked_at'])
        return Response({
            'message': 'Share link has been revoked. Clients will no longer have access.',
            'revoked_at': album.share_revoked_at.isoformat()
        })


# ----------------------------------------------------------------------
# Upload Preparation, Signing, Completion & Cancellation
# ----------------------------------------------------------------------

class PrepareMediaUploadView(APIView):
    """
    POST: Initiates an upload workflow by generating a strict server-controlled S3 object key
    and creating a pending Media record and UploadSession.
    Client supplies: filename, content_type, byte_size, is_archive, archive_part_number
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        serializer = PrepareMediaUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        raw_filename = data['filename']
        content_type = data.get('content_type', 'application/octet-stream')
        byte_size = data.get('byte_size', 0)
        is_archive = data.get('is_archive', False)
        part_number = data.get('archive_part_number')

        safe_name = s3_storage.sanitize_filename(raw_filename)
        ext = os.path.splitext(safe_name)[1].lower()

        # Determine media type securely
        if is_archive or ext in ('.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'):
            media_type = 'archive'
            is_archive = True
        elif content_type.startswith('video/') or ext in ('.mp4', '.mov', '.avi', '.mkv', '.webm'):
            media_type = 'video'
        elif content_type.startswith('image/') or ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.raw', '.cr2', '.nef', '.arw'):
            media_type = 'photo'
        else:
            media_type = 'other'

        import uuid
        media_id = uuid.uuid4()

        # Generate strictly server-controlled key: albums/<album_id>/<category>/<media_id>/<safe_name>
        category_folder = 'archives' if is_archive else ('videos' if media_type == 'video' else 'photos')
        object_key = f"albums/{album.id}/{category_folder}/{media_id}/{safe_name}"

        # If it's a photo, support preview companion upload
        preview_key = None
        preview_upload_url = None
        if media_type == 'photo':
            preview_key = f"albums/{album.id}/previews/{media_id}.webp"
            try:
                preview_upload_url = s3_storage.generate_presigned_upload_url(
                    preview_key,
                    content_type='image/webp',
                    expires_in=3600
                )
            except Exception as e:
                logger.warning(f"Failed to generate preview upload url: {e}")

        media = Media.objects.create(
            id=media_id,
            album=album,
            object_key=object_key,
            original_filename=safe_name,
            content_type=content_type,
            byte_size=byte_size,
            preview_key=preview_key,
            media_type=media_type,
            is_archive=is_archive,
            archive_part_number=part_number,
            upload_status='pending'
        )

        # Create upload session with 24-hour expiry
        session = UploadSession.objects.create(
            owner=request.user,
            media=media,
            object_key=object_key,
            state='initiated',
            expires_at=timezone.now() + timedelta(hours=24)
        )

        return Response({
            'media_id': str(media.id),
            'object_key': object_key,
            'preview_key': preview_key,
            'preview_upload_url': preview_upload_url,
            'session_id': str(session.id),
        }, status=status.HTTP_201_CREATED)


class S3SignRequestView(APIView):
    """
    POST: Dispatches presigned S3 URLs directly to Uppy's AwsS3 plugin for PUT, multipart POST,
    part PUT, complete POST, and abort DELETE.
    Enforces authorization: client can only request signatures for keys that belong to their active UploadSession!
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        serializer = S3SignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        method = data['method']
        key = data['key']
        upload_id = data.get('uploadId')
        part_number = data.get('partNumber')
        content_type = data.get('contentType')

        # Strictly authorize key: must belong to an active UploadSession for this album
        session = UploadSession.objects.filter(
            object_key=key,
            media__album=album,
            state__in=['initiated', 'uploading'],
            expires_at__gt=timezone.now()
        ).select_related('media').first()

        if not session:
            logger.warning(f"Unauthorized signing attempt for key: {key} by user: {request.user.id}")
            return Response(
                {'error': 'Unauthorized or expired upload session for this object key.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Transition session to uploading
        if session.state == 'initiated':
            session.state = 'uploading'
            session.media.upload_status = 'uploading'
            session.media.save(update_fields=['upload_status'])

        if upload_id and not session.multipart_upload_id:
            session.multipart_upload_id = upload_id
            session.save(update_fields=['state', 'multipart_upload_id'])
        else:
            session.save(update_fields=['state'])

        try:
            # Route to appropriate S3 presigning action
            if method == 'PUT' and not upload_id:
                # Single PutObject
                url = s3_storage.generate_presigned_upload_url(key, content_type=content_type)
            elif method == 'POST' and not upload_id:
                # Initiate Multipart Upload
                url = s3_storage.generate_presigned_create_multipart_url(key, content_type=content_type)
            elif method == 'PUT' and upload_id:
                # Upload Part
                if not part_number or part_number < 1 or part_number > 10000:
                    return Response({'error': 'Invalid partNumber.'}, status=status.HTTP_400_BAD_REQUEST)
                url = s3_storage.generate_presigned_part_url(key, upload_id, part_number)
            elif method == 'POST' and upload_id:
                # Complete Multipart Upload
                url = s3_storage.generate_presigned_complete_multipart_url(key, upload_id)
            elif method == 'DELETE' and upload_id:
                # Abort Multipart Upload
                url = s3_storage.generate_presigned_abort_multipart_url(key, upload_id)
            elif method == 'GET' and upload_id:
                # List Parts
                url = s3_storage.generate_presigned_list_parts_url(key, upload_id)
            else:
                return Response({'error': f'Unsupported S3 method {method}.'}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'url': url,
                'key': key
            })

        except s3_storage.StorageUnavailableError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.error(f"Error signing S3 request: {e}")
            return Response({'error': 'Failed to sign storage request.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CompleteMediaUploadView(APIView):
    """
    POST: Called when browser finishes upload.
    Performs server-side verification via S3 head_object:
    verifies object exists and validates non-zero size before marking status='ready'.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id, media_id):
        album = get_object_or_404(Album, id=album_id)
        media = get_object_or_404(Media, id=media_id, album=album)

        try:
            # Server-side verification: query Garage S3
            metadata = s3_storage.verify_and_get_object_metadata(media.object_key)
            actual_size = metadata['size']
            actual_etag = metadata['etag']

            # Update media record
            media.byte_size = actual_size
            media.etag = actual_etag
            media.upload_status = 'ready'
            media.save(update_fields=['byte_size', 'etag', 'upload_status', 'updated_at'])

            # Complete upload session
            UploadSession.objects.filter(media=media).update(state='completed')

            # Update client total storage bytes and photo count
            client = album.client
            client.storage_bytes = F('storage_bytes') + actual_size
            if media.media_type == 'photo':
                client.photo_count = F('photo_count') + 1
            client.save()
            client.refresh_from_db(fields=['storage_bytes', 'photo_count'])

            return Response({
                'status': 'ready',
                'media': MediaSerializer(media).data
            })

        except s3_storage.StorageNotFoundError:
            media.upload_status = 'failed'
            media.save(update_fields=['upload_status'])
            return Response(
                {'error': 'Uploaded object could not be found in storage. Upload may have failed or been interrupted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except s3_storage.StorageUnavailableError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class AbortMediaUploadView(APIView):
    """
    POST: Aborts an active upload session and cleans up multipart chunks on S3.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, album_id, media_id):
        album = get_object_or_404(Album, id=album_id)
        media = get_object_or_404(Media, id=media_id, album=album)

        sessions = UploadSession.objects.filter(media=media, state__in=['initiated', 'uploading'])
        for session in sessions:
            if session.multipart_upload_id:
                s3_storage.abort_multipart_upload_server(session.object_key, session.multipart_upload_id)
            session.state = 'aborted'
            session.save(update_fields=['state'])

        media.upload_status = 'failed'
        media.save(update_fields=['upload_status'])

        return Response({'detail': 'Upload session aborted and temporary parts discarded.'})


class AdminAlbumMediaListView(APIView):
    """
    GET: List media items for an album with pagination and filtering by type/status.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        qs = album.media_items.all()

        is_archive = request.query_params.get('is_archive')
        if is_archive is not None:
            qs = qs.filter(is_archive=(is_archive.lower() in ('true', '1')))

        upload_status = request.query_params.get('status')
        if upload_status:
            qs = qs.filter(upload_status=upload_status)

        media_type = request.query_params.get('media_type')
        if media_type:
            qs = qs.filter(media_type=media_type)

        paginator = StandardMediaPagination()
        page = paginator.paginate_queryset(qs.order_by('sort_order', '-created_at'), request)
        serializer = MediaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminMediaDetailDeleteView(APIView):
    """
    DELETE: Delete an individual media item from album and Garage S3.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, album_id, media_id):
        album = get_object_or_404(Album, id=album_id)
        media = get_object_or_404(Media, id=media_id, album=album)

        s3_storage.delete_object_server(media.object_key)
        if media.preview_key:
            s3_storage.delete_object_server(media.preview_key)

        freed_bytes = media.byte_size
        if freed_bytes > 0:
            client = album.client
            client.storage_bytes = max(0, client.storage_bytes - freed_bytes)
            if media.media_type == 'photo':
                client.photo_count = max(0, client.photo_count - 1)
            client.save()

        media.delete()
        return Response({'detail': 'Media deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------
# Public Client Album Gallery & Download Views (Secured by Token Hash)
# ----------------------------------------------------------------------

def resolve_active_album_or_error(share_token: str):
    """
    Resolves an album by the hash of its share token.
    Enforces expiry, revocation, and published status.
    Returns (album, None) or (None, (error_dict, status_code)).
    """
    token_hash = hash_download_token(share_token)
    album = Album.objects.filter(share_token_hash=token_hash).select_related('client').first()

    if not album:
        return None, ({'error': 'Album share link was not found. Please check the URL or contact the studio.'}, status.HTTP_404_NOT_FOUND)

    if album.share_revoked_at is not None:
        return None, ({'error': 'This album share link has been revoked by the photographer.'}, status.HTTP_410_GONE)

    if album.share_expires_at and album.share_expires_at <= timezone.now():
        return None, ({'error': 'This album share link has expired. Please contact the studio for a new link.'}, status.HTTP_410_GONE)

    if album.status != 'published':
        return None, ({'error': 'This album is currently in draft mode and not published.'}, status.HTTP_403_FORBIDDEN)

    return album, None


class ClientPublicAlbumView(APIView):
    """
    GET: Returns client-facing album view including photo/video gallery and prepared archives.
    Secured by cryptographically hashed share token.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, share_token):
        album, err = resolve_active_album_or_error(share_token)
        if err:
            return Response(err[0], status=err[1])

        # Get ready media items
        media_qs = album.media_items.filter(upload_status='ready', is_archive=False).order_by('sort_order', 'created_at')
        
        # Paginated media
        paginator = StandardMediaPagination()
        paginated_media = paginator.paginate_queryset(media_qs, request)
        media_serializer = MediaSerializer(paginated_media, many=True)

        # Prepared archives (for "Download All" multi-part collections)
        archives = album.media_items.filter(upload_status='ready', is_archive=True).order_by('archive_part_number', 'original_filename')
        archives_data = [
            {
                'id': str(a.id),
                'filename': a.original_filename,
                'part_number': a.archive_part_number or (i + 1),
                'byte_size': a.byte_size,
            }
            for i, a in enumerate(archives)
        ]

        client = album.client
        return paginator.get_paginated_response({
            'album': {
                'id': str(album.id),
                'title': album.title,
                'description': album.description,
                'client_names': f"{client.groom_name} & {client.bride_name}",
                'event_date': client.event_date.isoformat() if client.event_date else None,
                'created_at': album.created_at.isoformat(),
                'expires_at': album.share_expires_at.isoformat() if album.share_expires_at else None,
            },
            'archives': archives_data,
            'items': media_serializer.data
        })


class ClientDownloadMediaView(APIView):
    """
    GET: Generates a short-lived presigned GET URL for downloading an original photo, video, or archive part.
    Enforces ownership and safe Content-Disposition.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, share_token, media_id):
        album, err = resolve_active_album_or_error(share_token)
        if err:
            return Response(err[0], status=err[1])

        media = album.media_items.filter(id=media_id, upload_status='ready').first()
        if not media:
            return Response({'error': 'Requested media item not found in this album.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            download_url = s3_storage.generate_presigned_download_url(
                media.object_key,
                filename=media.original_filename,
                expires_in=300,  # 5-minute expiry
                inline=False
            )
            return Response({
                'download_url': download_url,
                'filename': media.original_filename,
                'byte_size': media.byte_size,
                'content_type': media.content_type
            })
        except s3_storage.StorageUnavailableError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.error(f"Error generating download URL for media {media.id}: {e}")
            return Response({'error': 'Storage temporarily unavailable. Please retry in a few moments.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class ClientPreviewMediaView(APIView):
    """
    GET: Generates a short-lived presigned GET URL with inline Content-Disposition
    for displaying media inside a lightbox or browser player.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, share_token, media_id):
        album, err = resolve_active_album_or_error(share_token)
        if err:
            return Response(err[0], status=err[1])

        media = album.media_items.filter(id=media_id, upload_status='ready').first()
        if not media:
            return Response({'error': 'Requested media item not found in this album.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            # If preview_key exists, use it; otherwise use original key with inline disposition
            target_key = media.preview_key if media.preview_key else media.object_key
            preview_url = s3_storage.generate_presigned_download_url(
                target_key,
                filename=media.original_filename,
                expires_in=3600,
                inline=True
            )
            return Response({
                'preview_url': preview_url,
                'media_type': media.media_type,
                'filename': media.original_filename
            })
        except s3_storage.StorageUnavailableError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.error(f"Error generating preview URL for media {media.id}: {e}")
            return Response({'error': 'Storage temporarily unavailable.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

