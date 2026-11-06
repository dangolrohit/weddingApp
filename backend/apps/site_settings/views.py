import os
from pathlib import Path
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import SiteSetting

class SiteSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request):
        return Response(SiteSetting.get_all_settings(), status=status.HTTP_200_OK)

    def put(self, request):
        data = request.data
        if not isinstance(data, dict):
            return Response({'detail': 'Payload must be a JSON dictionary of setting groups.'}, status=status.HTTP_400_BAD_REQUEST)

        updated = {}
        for group_key, group_val in data.items():
            if isinstance(group_val, dict):
                current = SiteSetting.get_setting(group_key)
                if isinstance(current, dict):
                    current.update(group_val)
                    SiteSetting.set_setting(group_key, current)
                    updated[group_key] = current
                else:
                    SiteSetting.set_setting(group_key, group_val)
                    updated[group_key] = group_val

        return Response(SiteSetting.get_all_settings(), status=status.HTTP_200_OK)

class WatermarkUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('image')
        if not file_obj:
            return Response({'detail': 'No image file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure branding directory exists
        branding_dir = Path(settings.MEDIA_ROOT) / 'branding'
        branding_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file_obj.name).suffix.lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp', '.svg'):
            return Response({'detail': 'Unsupported image format.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"watermark_logo{ext}"
        filepath = branding_dir / filename

        with open(filepath, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)

        storage_key = f"branding/{filename}"
        watermark_settings = SiteSetting.get_setting('watermark')
        watermark_settings['image_key'] = storage_key
        SiteSetting.set_setting('watermark', watermark_settings)

        return Response({
            'detail': 'Watermark logo uploaded successfully.',
            'image_key': storage_key
        }, status=status.HTTP_200_OK)

class BrandingLogoUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('image')
        if not file_obj:
            return Response({'detail': 'No logo file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        branding_dir = Path(settings.MEDIA_ROOT) / 'branding'
        branding_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file_obj.name).suffix.lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp', '.svg'):
            return Response({'detail': 'Unsupported image format.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"studio_logo{ext}"
        filepath = branding_dir / filename

        with open(filepath, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)

        storage_key = f"branding/{filename}"
        branding_settings = SiteSetting.get_setting('branding')
        branding_settings['logo_key'] = storage_key
        SiteSetting.set_setting('branding', branding_settings)

        return Response({
            'detail': 'Studio logo uploaded successfully.',
            'logo_key': storage_key
        }, status=status.HTTP_200_OK)

