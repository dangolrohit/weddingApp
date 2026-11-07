import mimetypes
from pathlib import Path
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.http import HttpResponse, Http404, FileResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.clients.models import Client
from apps.core.utils import (
    normalize_name_key,
    verify_passkey,
    sign_client_session,
    verify_client_session,
    generate_download_token,
    hash_download_token
)
from apps.core.pagination import StandardResultsSetPagination
from apps.site_settings.models import SiteSetting
from .models import AccessAttempt, DownloadLink, DownloadLog, ZipBundle
from .bundle import get_or_create_client_zip_bundle
from .serializers import (
    ClientVerifySerializer,
    ClientPreviewPhotoSerializer,
    ClientLinkRequestSerializer,
    AdminSendLinkSerializer,
    AdminDownloadLinkSerializer,
    mask_email
)
from .tasks import send_download_link_email_task

def get_client_ip(request):
    """Extracts client IP address respecting reverse proxy headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ==========================================
# 1. CLIENT VERIFICATION & PREVIEW ENDPOINTS
# ==========================================

class GetMyImageVerifyView(APIView):
    """
    Verifies client names and passkey for the 'Get My Image' portal.
    Enforces brute-force protection (5 failed attempts per client or IP in 15 mins).
    Returns a cryptographically signed 30-minute session token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        ip = get_client_ip(request)
        since = timezone.now() - timedelta(minutes=15)

        # 1. IP-level brute-force check
        failed_ip_count = AccessAttempt.objects.filter(
            ip_address=ip,
            success=False,
            created_at__gte=since
        ).count()

        if failed_ip_count >= 5:
            return Response({
                'detail': 'Too many failed verification attempts. For security, please wait 15 minutes before trying again.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        serializer = ClientVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name_input = serializer.validated_data.get('name', '').strip()
        groom_name = serializer.validated_data.get('groom_name', '').strip()
        bride_name = serializer.validated_data.get('bride_name', '').strip()
        raw_passkey = serializer.validated_data['passkey'].strip()

        if name_input:
            name_key = normalize_name_key(name_input, '')
        else:
            name_key = normalize_name_key(groom_name, bride_name)

        # Find active published client
        client = Client.objects.filter(
            name_key=name_key,
            status='published',
            deleted_at__isnull=True
        ).first()

        # Smart fallback matching for single name or partial event names with valid passkey
        if not client:
            candidates = Client.objects.filter(status='published', deleted_at__isnull=True)
            for c in candidates:
                if verify_passkey(raw_passkey, c.passkey_hash):
                    c_words = set(c.name_key.split())
                    entered_words = set(name_key.split())
                    if entered_words and entered_words.intersection(c_words):
                        client = c
                        break

        # 2. Client-level brute-force check
        if client:
            failed_client_count = AccessAttempt.objects.filter(
                client=client,
                success=False,
                created_at__gte=since
            ).count()
            if failed_client_count >= 5:
                return Response({
                    'detail': 'Too many failed verification attempts for this gallery. Please wait 15 minutes or contact your photographer.'
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Constant-time passkey verification
        is_valid = client is not None and verify_passkey(raw_passkey, client.passkey_hash)

        if not is_valid:
            AccessAttempt.objects.create(
                ip_address=ip,
                client=client,
                success=False
            )
            return Response({
                'detail': 'The names or passkey entered could not be verified. Please check and try again.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verification Succeeded
        AccessAttempt.objects.create(
            ip_address=ip,
            client=client,
            success=True
        )

        session_token = sign_client_session(str(client.id))

        # Published Garage S3 albums for this client
        published_albums = []
        for alb in client.albums.filter(status='published'):
            published_albums.append({
                'id': str(alb.id),
                'title': alb.title,
                'description': alb.description,
                'media_count': alb.media_items.filter(upload_status='ready', is_archive=False).count(),
                'archive_count': alb.media_items.filter(upload_status='ready', is_archive=True).count(),
                'share_token': alb.share_token_hash,
            })

        response_data = {
            'session_token': session_token,
            'client': {
                'id': client.id,
                'display_name': client.display_name,
                'groom_name': client.groom_name,
                'bride_name': client.bride_name,
                'event_date': client.event_date,
                'photo_count': client.photos.filter(is_hidden=False, status='ready').count(),
                'linked_email': mask_email(client.linked_email) if client.linked_email else None,
                'email_locked': client.email_locked,
                'albums': published_albums,
            }
        }

        response = Response(response_data, status=status.HTTP_200_OK)
        response.set_cookie(
            'client_session',
            session_token,
            max_age=1800,
            httponly=True,
            samesite='Lax'
        )
        return response


class GetMyImagePhotosView(APIView):
    """
    Returns paginated watermarked previews for the verified client.
    Requires a valid, signed 30-minute client session.
    """
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        session_token = request.headers.get('X-Client-Session') or request.COOKIES.get('client_session')
        client_id = verify_client_session(session_token)

        if not client_id:
            return Response({
                'detail': 'Your session has expired or is invalid. Please verify your passkey again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        client = Client.objects.filter(id=client_id, status='published', deleted_at__isnull=True).first()
        if not client:
            return Response({'detail': 'Client gallery not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

        photos = client.photos.filter(status='ready', is_hidden=False).order_by('sort_order', 'created_at')

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(photos, request)
        serializer = ClientPreviewPhotoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class GetMyImageRequestLinkView(APIView):
    """
    Allows a verified client to request their full collection download link.
    Locks the email upon first submission.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        session_token = request.headers.get('X-Client-Session') or request.COOKIES.get('client_session')
        client_id = verify_client_session(session_token)

        if not client_id:
            return Response({
                'detail': 'Your session has expired or is invalid. Please verify your passkey again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        client = Client.objects.filter(id=client_id, status='published', deleted_at__isnull=True).first()
        if not client:
            return Response({'detail': 'Client gallery not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check email locking rules
        if client.email_locked and client.linked_email:
            recipient_email = client.linked_email
        else:
            serializer = ClientLinkRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            email_input = serializer.validated_data.get('email', '').strip()

            if not email_input:
                return Response({'detail': 'Please provide a valid email address to receive your download link.'}, status=status.HTTP_400_BAD_REQUEST)

            recipient_email = email_input
            client.linked_email = recipient_email
            client.email_locked = True
            client.save(update_fields=['linked_email', 'email_locked'])

        # Read delivery settings
        delivery_settings = SiteSetting.get_setting('delivery')
        valid_days = int(delivery_settings.get('link_valid_days', 7))
        max_downloads = int(delivery_settings.get('max_downloads', 10))
        revoke_on_send = bool(delivery_settings.get('revoke_on_send', True))

        # Revoke previous links if configured
        if revoke_on_send:
            DownloadLink.objects.filter(
                client=client,
                revoked_at__isnull=True
            ).update(revoked_at=timezone.now())

        # Ensure ZIP bundle is ready
        bundle = get_or_create_client_zip_bundle(client)

        raw_token = generate_download_token()
        token_hash = hash_download_token(raw_token)
        expires_at = timezone.now() + timedelta(days=valid_days)

        link = DownloadLink.objects.create(
            client=client,
            bundle=bundle,
            token_hash=token_hash,
            email=recipient_email,
            expires_at=expires_at,
            max_downloads=max_downloads,
            created_by=None
        )

        base_url = request.build_absolute_uri('/')
        try:
            send_download_link_email_task.delay(str(link.id), raw_token, base_url)
        except Exception:
            send_download_link_email_task(str(link.id), raw_token, base_url)

        return Response({
            'message': f"A secure download link has been sent to {mask_email(recipient_email)}! It is valid for {valid_days} days.",
            'masked_email': mask_email(recipient_email),
            'expires_at': expires_at.isoformat()
        }, status=status.HTTP_200_OK)


# ==========================================
# 2. ADMIN SEND & LINK MANAGEMENT ENDPOINTS
# ==========================================

class AdminClientSendLinkView(APIView):
    """
    Admin action to dispatch a download link to a client.
    Allows editing the destination email and optionally saving it as the client's locked email.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminSendLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_email = serializer.validated_data['email'].strip()
        save_email = serializer.validated_data['save_email']
        revoke_previous = serializer.validated_data['revoke_previous']

        if save_email or not client.linked_email:
            client.linked_email = target_email
            client.email_locked = True
            client.save(update_fields=['linked_email', 'email_locked'])

        # Revoke previous links if requested
        if revoke_previous:
            DownloadLink.objects.filter(
                client=client,
                revoked_at__isnull=True
            ).update(revoked_at=timezone.now())

        # Ensure ZIP bundle is ready
        bundle = get_or_create_client_zip_bundle(client)

        delivery_settings = SiteSetting.get_setting('delivery')
        valid_days = int(delivery_settings.get('link_valid_days', 7))
        max_downloads = int(delivery_settings.get('max_downloads', 10))

        raw_token = generate_download_token()
        token_hash = hash_download_token(raw_token)
        expires_at = timezone.now() + timedelta(days=valid_days)

        link = DownloadLink.objects.create(
            client=client,
            bundle=bundle,
            token_hash=token_hash,
            email=target_email,
            expires_at=expires_at,
            max_downloads=max_downloads,
            created_by=request.user
        )

        base_url = request.build_absolute_uri('/')
        try:
            send_download_link_email_task.delay(str(link.id), raw_token, base_url)
        except Exception:
            send_download_link_email_task(str(link.id), raw_token, base_url)

        return Response({
            'detail': f'Download link created and dispatched to {target_email}.',
            'raw_token': raw_token,
            'download_url': f"{base_url.rstrip('/')}/d/{raw_token}",
            'link': AdminDownloadLinkSerializer(link).data
        }, status=status.HTTP_201_CREATED)


class AdminClientLinksView(APIView):
    """Lists link delivery history for a specific client."""
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        try:
            client = Client.objects.get(id=client_id)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        links = client.download_links.order_by('-created_at')
        serializer = AdminDownloadLinkSerializer(links, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminRevokeLinkView(APIView):
    """Revokes a specific download link immediately."""
    permission_classes = [IsAuthenticated]

    def post(self, request, link_id):
        try:
            link = DownloadLink.objects.get(id=link_id)
        except (DownloadLink.DoesNotExist, ValueError):
            return Response({'detail': 'Link not found.'}, status=status.HTTP_404_NOT_FOUND)

        link.revoked_at = timezone.now()
        link.save(update_fields=['revoked_at'])
        return Response({'detail': 'Link successfully revoked.'}, status=status.HTTP_200_OK)


# ==========================================
# 3. PUBLIC /d/{token} DOWNLOAD ENDPOINTS
# ==========================================

class PublicDownloadStatusView(APIView):
    """
    Validates token and returns download status, expiry, and ZIP part list for /d/{token}.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        token_hash = hash_download_token(token)
        link = DownloadLink.objects.select_related('client', 'bundle').filter(token_hash=token_hash).first()

        if not link:
            return Response({'detail': 'Download link not found.'}, status=status.HTTP_404_NOT_FOUND)

        branding = SiteSetting.get_setting('branding')

        if link.revoked_at is not None:
            return Response({
                'status': 'revoked',
                'detail': 'This download link has been revoked by the studio administrator.',
                'contact': branding
            }, status=status.HTTP_410_GONE)

        if link.expires_at < timezone.now():
            return Response({
                'status': 'expired',
                'detail': 'This download link has expired after 7 days.',
                'contact': branding
            }, status=status.HTTP_410_GONE)

        if link.download_count >= link.max_downloads:
            return Response({
                'status': 'limit_reached',
                'detail': f'This download link has reached its maximum limit of {link.max_downloads} downloads.',
                'contact': branding
            }, status=status.HTTP_403_FORBIDDEN)

        # Check bundle readiness
        bundle = link.bundle
        if not bundle or bundle.status == 'building':
            return Response({
                'status': 'building',
                'detail': 'Your photo collection is currently being prepared into archives. Please refresh this page in a moment.'
            }, status=status.HTTP_200_OK)

        if bundle.status == 'failed':
            return Response({
                'status': 'failed',
                'detail': 'There was an issue preparing the ZIP archives. Please contact the studio for a replacement link.',
                'contact': branding
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'status': 'active',
            'client_names': f"{link.client.groom_name} & {link.client.bride_name}",
            'event_date': link.client.event_date,
            'expires_at': link.expires_at.isoformat(),
            'max_downloads': link.max_downloads,
            'download_count': link.download_count,
            'parts': bundle.parts,
            'photo_count': bundle.photo_count,
            'total_bytes': bundle.total_bytes,
            'studio_name': branding.get('studio_name', 'Wedding Studio'),
        }, status=status.HTTP_200_OK)


class PublicDownloadPartView(APIView):
    """
    Streams a specific ZIP part to the client.
    Increments download count and creates DownloadLog audit entry.
    Handoff to Nginx using X-Accel-Redirect (or FileResponse in dev).
    """
    permission_classes = [AllowAny]

    def get(self, request, token, part_no):
        token_hash = hash_download_token(token)
        link = DownloadLink.objects.select_related('client', 'bundle').filter(token_hash=token_hash).first()

        if not link:
            raise Http404("Download link not found")

        if link.revoked_at is not None or link.expires_at < timezone.now() or link.download_count >= link.max_downloads:
            return Response({'detail': 'This download link is no longer active.'}, status=status.HTTP_403_FORBIDDEN)

        bundle = link.bundle
        if not bundle or bundle.status != 'ready':
            return Response({'detail': 'ZIP archive is not ready.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Find the requested part
        part_no_int = int(part_no)
        target_part = None
        for p in bundle.parts:
            if int(p.get('part', 0)) == part_no_int:
                target_part = p
                break

        if not target_part:
            raise Http404("ZIP part not found")

        full_path = (Path(settings.MEDIA_ROOT) / target_part['storage_key']).resolve()
        media_root_resolved = Path(settings.MEDIA_ROOT).resolve()
        try:
            if not full_path.is_relative_to(media_root_resolved) or not full_path.exists():
                raise Http404("ZIP part file missing on disk")
        except ValueError:
            raise Http404("ZIP part file missing on disk")

        # Increment download counter & write download audit log
        link.download_count += 1
        link.save(update_fields=['download_count'])

        ip = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', '')
        DownloadLog.objects.create(
            link=link,
            part_no=part_no_int,
            ip_address=ip,
            user_agent=ua
        )

        # Clean download filename: Groom_Bride_Part01.zip
        clean_groom = link.client.groom_name.replace(' ', '_')
        clean_bride = link.client.bride_name.replace(' ', '_')
        download_name = f"{clean_groom}_{clean_bride}_Part{part_no_int:02d}.zip"

        # Direct media serving for dev / testing fallback
        if getattr(settings, 'SERVE_DIRECT_MEDIA', False):
            response = FileResponse(open(full_path, 'rb'), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="{download_name}"'
            return response

        # Production / Nginx streaming via X-Accel-Redirect
        response = HttpResponse(status=status.HTTP_200_OK)
        response['X-Accel-Redirect'] = f"/protected/{target_part['storage_key']}"
        response['Content-Type'] = 'application/zip'
        response['Content-Disposition'] = f'attachment; filename="{download_name}"'
        response['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
        return response
