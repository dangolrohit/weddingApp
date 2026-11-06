from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

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
from .models import AccessAttempt, DownloadLink
from .serializers import (
    ClientVerifySerializer,
    ClientPreviewPhotoSerializer,
    ClientLinkRequestSerializer,
    mask_email
)
from .tasks import send_download_link_email_task

def get_client_ip(request):
    """Extracts client IP address respecting reverse proxy headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


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

        groom_name = serializer.validated_data['groom_name']
        bride_name = serializer.validated_data['bride_name']
        raw_passkey = serializer.validated_data['passkey']

        name_key = normalize_name_key(groom_name, bride_name)

        # Find active published client
        client = Client.objects.filter(
            name_key=name_key,
            status='published',
            deleted_at__isnull=True
        ).first()

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

        response_data = {
            'session_token': session_token,
            'client': {
                'id': client.id,
                'groom_name': client.groom_name,
                'bride_name': client.bride_name,
                'event_date': client.event_date,
                'photo_count': client.photos.filter(is_hidden=False, status='ready').count(),
                'linked_email': mask_email(client.linked_email) if client.linked_email else None,
                'email_locked': client.email_locked,
            }
        }

        response = Response(response_data, status=status.HTTP_200_OK)
        # Also attach cookie for browser clients
        response.set_cookie(
            'client_session',
            session_token,
            max_age=1800, # 30 minutes
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

        # Generate fresh download token & link
        raw_token = generate_download_token()
        token_hash = hash_download_token(raw_token)
        expires_at = timezone.now() + timedelta(days=valid_days)

        link = DownloadLink.objects.create(
            client=client,
            token_hash=token_hash,
            email=recipient_email,
            expires_at=expires_at,
            max_downloads=max_downloads,
            created_by=None # requested by the client
        )

        base_url = request.build_absolute_uri('/')
        try:
            send_download_link_email_task.delay(str(link.id), raw_token, base_url)
        except Exception:
            # Fallback to synchronous in local/dev
            send_download_link_email_task(str(link.id), raw_token, base_url)

        return Response({
            'message': f"A secure download link has been sent to {mask_email(recipient_email)}! It is valid for {valid_days} days.",
            'masked_email': mask_email(recipient_email),
            'expires_at': expires_at.isoformat()
        }, status=status.HTTP_200_OK)
