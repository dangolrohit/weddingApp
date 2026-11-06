from django.urls import path
from .views import (
    ClientPhotoListUploadView,
    PhotoDetailView,
    PhotoReorderView,
    ShowcasePickerView,
    ProtectedFileServeView
)

urlpatterns = [
    # Admin photo management endpoints
    path('api/admin/clients/<uuid:client_id>/photos', ClientPhotoListUploadView.as_view(), name='admin_client_photos'),
    path('api/admin/photos/<uuid:pk>', PhotoDetailView.as_view(), name='admin_photo_detail'),
    path('api/admin/clients/<uuid:client_id>/photos/reorder', PhotoReorderView.as_view(), name='admin_photos_reorder'),
    path('api/admin/clients/<uuid:client_id>/showcase', ShowcasePickerView.as_view(), name='admin_client_showcase'),

    # Protected file delivery (X-Accel-Redirect)
    path('files/<str:kind>/<path:file_id>', ProtectedFileServeView.as_view(), name='protected_file_serve'),
]
