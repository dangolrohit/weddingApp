from django.urls import path
from .views import SiteSettingsView, WatermarkUploadView, BrandingLogoUploadView

urlpatterns = [
    path('admin/settings', SiteSettingsView.as_view(), name='admin_settings'),
    path('admin/settings/watermark-image', WatermarkUploadView.as_view(), name='admin_watermark_image_upload'),
    path('admin/settings/branding-logo', BrandingLogoUploadView.as_view(), name='admin_branding_logo_upload'),
]
