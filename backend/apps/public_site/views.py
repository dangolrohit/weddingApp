from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.photos.tasks import generate_showcase_variant
from apps.site_settings.models import SiteSetting
from .models import Inquiry
from .serializers import (
    PublicCategorySerializer,
    PublicShowcasePhotoSerializer,
    InquirySerializer
)

class PublicCategoriesView(APIView):
    """Returns visible categories for public portfolio filter tabs."""
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.filter(is_visible=True).order_by('sort_order', 'name')
        serializer = PublicCategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicShowcaseView(APIView):
    """
    Returns curated showcase photos (maximum 3 per published client).
    Optionally filterable by category slug or ID.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        clients = Client.objects.filter(
            status='published',
            deleted_at__isnull=True
        ).select_related('category').prefetch_related('photos', 'photos__variants')

        category_param = request.query_params.get('category', '').strip()
        if category_param:
            try:
                import uuid
                cat_uuid = uuid.UUID(category_param)
                clients = clients.filter(Q(category_id=cat_uuid) | Q(category__slug=category_param))
            except ValueError:
                clients = clients.filter(category__slug=category_param)

        showcase_photos = []

        for client in clients:
            # Query photos assigned to showcase (order 1..3)
            client_showcase = list(
                client.photos.filter(
                    showcase_order__isnull=False,
                    is_hidden=False
                ).order_by('showcase_order')[:3]
            )

            # PRD requirement: if no showcase photos were explicitly chosen,
            # default up to the first 3 ready photos
            if not client_showcase:
                ready_photos = list(
                    client.photos.filter(
                        status='ready',
                        is_hidden=False
                    ).order_by('sort_order', 'created_at')[:3]
                )
                for idx, photo in enumerate(ready_photos, start=1):
                    photo.showcase_order = idx
                    photo.save(update_fields=['showcase_order'])
                    generate_showcase_variant(photo)
                    client_showcase.append(photo)
            else:
                # Ensure showcase variants exist on disk
                for photo in client_showcase:
                    if not photo.variants.filter(kind='showcase').exists():
                        generate_showcase_variant(photo)

            showcase_photos.extend(client_showcase)

        # Sort showcase items: client event date / creation desc, then showcase order
        showcase_photos.sort(
            key=lambda p: (
                p.client.event_date or p.client.created_at.date(),
                -(p.showcase_order or 0)
            ),
            reverse=True
        )

        serializer = PublicShowcasePhotoSerializer(showcase_photos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicBrandingView(APIView):
    """Returns public studio branding and watermark info."""
    permission_classes = [AllowAny]

    def get(self, request):
        branding = SiteSetting.get_setting('branding')
        return Response({
            'branding': branding,
        }, status=status.HTTP_200_OK)


class PublicInquiryCreateView(APIView):
    """Accepts client/visitor inquiries from the public website."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inquiry = serializer.save()
        return Response({
            'id': inquiry.id,
            'message': 'Thank you for reaching out! We will be in touch with you shortly.'
        }, status=status.HTTP_201_CREATED)
