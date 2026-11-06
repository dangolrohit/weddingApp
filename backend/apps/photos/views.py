import os
import mimetypes
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, FileResponse, Http404
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Photo, PhotoVariant
from .serializers import PhotoSerializer, PhotoReorderSerializer, ShowcaseUpdateSerializer
from .tasks import process_photo_task, generate_showcase_variant, update_client_storage_bytes
from apps.clients.models import Client
from apps.core.utils import verify_client_session

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heic', '.heif'}

class ClientPhotoListUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        photos = client.photos.all().order_by('sort_order', 'created_at')
        serializer = PhotoSerializer(photos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not uploaded_files:
            return Response({'detail': 'No photo files provided.'}, status=status.HTTP_400_BAD_REQUEST)

        created_photos = []
        originals_dir = Path(settings.MEDIA_ROOT) / 'originals' / str(client.id)
        originals_dir.mkdir(parents=True, exist_ok=True)

        for file_obj in uploaded_files:
            ext = Path(file_obj.name).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue # Skip unsupported non-image formats

            photo = Photo.objects.create(
                client=client,
                original_filename=file_obj.name,
                storage_key='',
                mime_type=file_obj.content_type or mimetypes.guess_type(file_obj.name)[0],
                size_bytes=file_obj.size,
                status='processing'
            )

            # Store original under /media/originals/{client_id}/{photo_id}.{ext}
            filename = f"{photo.id}{ext}"
            file_path = originals_dir / filename
            storage_key = f"originals/{client.id}/{filename}"

            with open(file_path, 'wb+') as dest:
                for chunk in file_obj.chunks():
                    dest.write(chunk)

            photo.storage_key = storage_key
            photo.save(update_fields=['storage_key'])

            # Automatically set first 3 uploaded photos as showcase if none exist
            current_showcase_count = client.photos.filter(showcase_order__isnull=False).count()
            if current_showcase_count < 3 and not photo.showcase_order:
                photo.showcase_order = current_showcase_count + 1
                photo.save(update_fields=['showcase_order'])

            # Trigger background variant processing
            try:
                process_photo_task.delay(str(photo.id))
            except Exception:
                # Fallback to direct synchronous execution in dev/test if Celery broker is offline
                process_photo_task(str(photo.id))

            created_photos.append(photo)

        # Update client storage bytes & photo count
        update_client_storage_bytes(client)

        serializer = PhotoSerializer(created_photos, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PhotoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Photo.objects.select_related('client').get(pk=pk)
        except (Photo.DoesNotExist, ValueError):
            return None

    def patch(self, request, pk):
        photo = self.get_object(pk)
        if not photo:
            return Response({'detail': 'Photo not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_hidden = request.data.get('is_hidden')
        if is_hidden is not None:
            photo.is_hidden = bool(is_hidden)

        sort_order = request.data.get('sort_order')
        if sort_order is not None:
            photo.sort_order = int(sort_order)

        photo.save(update_fields=['is_hidden', 'sort_order'])
        serializer = PhotoSerializer(photo)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        photo = self.get_object(pk)
        if not photo:
            return Response({'detail': 'Photo not found.'}, status=status.HTTP_404_NOT_FOUND)

        client = photo.client

        # Delete physical files
        media_root = Path(settings.MEDIA_ROOT)
        if photo.storage_key:
            orig = media_root / photo.storage_key
            if orig.exists():
                orig.unlink(missing_ok=True)

        for variant in photo.variants.all():
            v_path = media_root / variant.storage_key
            if v_path.exists():
                v_path.unlink(missing_ok=True)

        # Delete database record
        photo.delete()

        # Recalculate client stats
        update_client_storage_bytes(client)

        return Response(status=status.HTTP_204_NO_CONTENT)


class PhotoReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PhotoReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        photo_orders = serializer.validated_data['photo_orders']
        with transaction.atomic():
            for item in photo_orders:
                p_id = item.get('id')
                order = item.get('sort_order')
                if p_id and order is not None:
                    client.photos.filter(id=p_id).update(sort_order=order)

        return Response({'detail': 'Photo order updated successfully.'}, status=status.HTTP_200_OK)


class ShowcasePickerView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ShowcaseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo_ids = serializer.validated_data['photo_ids']

        with transaction.atomic():
            # Reset existing showcase orders for this client
            client.photos.update(showcase_order=None)

            # Assign new showcase orders 1, 2, 3
            for index, p_id in enumerate(photo_ids[:3], start=1):
                photo = client.photos.filter(id=p_id).first()
                if photo:
                    photo.showcase_order = index
                    photo.save(update_fields=['showcase_order'])
                    # Generate showcase variant immediately
                    generate_showcase_variant(photo)

        updated_photos = client.photos.filter(showcase_order__isnull=False).order_by('showcase_order')
        return Response(PhotoSerializer(updated_photos, many=True).data, status=status.HTTP_200_OK)


class ProtectedFileServeView(APIView):
    """
    Protected file delivery endpoint.
    Django validates authorization (Admin JWT, signed client session, or public showcase)
    and hands off streaming to Nginx using X-Accel-Redirect.
    """
    permission_classes = [AllowAny]

    def get(self, request, kind, file_id):
        # 1. Branding Assets (Logo & Watermark images)
        if kind == 'branding':
            branding_path = Path(settings.MEDIA_ROOT) / 'branding' / file_id
            if not branding_path.exists():
                raise Http404("File not found")
            return self._serve_file(request, f"branding/{file_id}", branding_path)

        # 2. Photo Variants
        try:
            photo = Photo.objects.select_related('client').get(id=file_id)
        except (Photo.DoesNotExist, ValueError):
            raise Http404("Photo not found")

        # Public Showcase Permission Check
        if kind == 'showcase':
            # Publicly accessible only if photo is marked showcase and client is published and active
            if photo.showcase_order is None or photo.client.status != 'published' or photo.client.is_deleted:
                return Response({'detail': 'Access forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        # Thumbnails and Previews Permission Check
        elif kind in ('thumb', 'preview'):
            is_admin = request.user and request.user.is_authenticated and request.user.is_active
            is_verified_client = False

            if not is_admin:
                session_token = request.headers.get('X-Client-Session') or request.COOKIES.get('client_session')
                verified_id = verify_client_session(session_token)
                if verified_id and str(verified_id) == str(photo.client.id) and not photo.is_hidden:
                    is_verified_client = True

            if not is_admin and not is_verified_client:
                return Response({'detail': 'Authentication required to view this photo.'}, status=status.HTTP_403_FORBIDDEN)

        # Originals are never served directly!
        else:
            return Response({'detail': 'Direct original photo download is not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        # Find the storage key for this variant
        variant = photo.variants.filter(kind=kind).first()
        if not variant:
            raise Http404("Variant not found or still processing")

        full_path = Path(settings.MEDIA_ROOT) / variant.storage_key
        if not full_path.exists():
            raise Http404("Variant file missing on disk")

        return self._serve_file(request, variant.storage_key, full_path)

    def _serve_file(self, request, storage_key: str, full_path: Path):
        content_type = mimetypes.guess_type(str(full_path))[0] or 'application/octet-stream'

        # If running directly without nginx (e.g. testing or dev fallback)
        if getattr(settings, 'SERVE_DIRECT_MEDIA', False):
            response = FileResponse(open(full_path, 'rb'), content_type=content_type)
            response['Cache-Control'] = 'private, max-age=86400'
            return response

        # Production / Nginx streaming via X-Accel-Redirect
        response = HttpResponse(status=status.HTTP_200_OK)
        response['X-Accel-Redirect'] = f"/protected/{storage_key}"
        response['Content-Type'] = content_type
        response['Cache-Control'] = 'private, max-age=86400'
        return response
