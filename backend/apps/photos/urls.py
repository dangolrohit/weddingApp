from django.urls import path
from .views import (
    ClientPhotoListUploadView,
    PhotoDetailView,
    PhotoReorderView,
    ShowcasePickerView,
    ProtectedFileServeView
)
from . import views_s3
from . import dev_s3_mock

urlpatterns = [
    # Dev S3 Mock (for local testing without running Garage/Docker)
    path('api/dev-s3/<path:path>', dev_s3_mock.DevS3MockView.as_view(), name='dev_s3_mock'),

    # Legacy Photo management endpoints
    path('api/admin/clients/<uuid:client_id>/photos', ClientPhotoListUploadView.as_view(), name='admin_client_photos'),
    path('api/admin/photos/<uuid:pk>', PhotoDetailView.as_view(), name='admin_photo_detail'),
    path('api/admin/clients/<uuid:client_id>/photos/reorder', PhotoReorderView.as_view(), name='admin_photos_reorder'),
    path('api/admin/clients/<uuid:client_id>/showcase', ShowcasePickerView.as_view(), name='admin_client_showcase'),

    # Album & Garage S3 Storage Endpoints
    path('api/admin/clients/<uuid:client_id>/albums', views_s3.ClientAlbumListCreateView.as_view(), name='admin_client_albums'),
    path('api/admin/albums/<uuid:album_id>', views_s3.AdminAlbumDetailView.as_view(), name='admin_album_detail'),
    path('api/admin/albums/<uuid:album_id>/share-link', views_s3.AlbumShareLinkView.as_view(), name='admin_album_share_link'),
    path('api/admin/albums/<uuid:album_id>/revoke-share', views_s3.AlbumRevokeShareView.as_view(), name='admin_album_revoke_share'),
    path('api/admin/albums/<uuid:album_id>/media', views_s3.AdminAlbumMediaListView.as_view(), name='admin_album_media_list'),
    path('api/admin/albums/<uuid:album_id>/media/prepare', views_s3.PrepareMediaUploadView.as_view(), name='admin_album_media_prepare'),
    path('api/admin/albums/<uuid:album_id>/s3-sign', views_s3.S3SignRequestView.as_view(), name='admin_album_s3_sign'),
    path('api/admin/albums/<uuid:album_id>/media/<uuid:media_id>/complete', views_s3.CompleteMediaUploadView.as_view(), name='admin_album_media_complete'),
    path('api/admin/albums/<uuid:album_id>/media/<uuid:media_id>/abort', views_s3.AbortMediaUploadView.as_view(), name='admin_album_media_abort'),
    path('api/admin/albums/<uuid:album_id>/media/<uuid:media_id>', views_s3.AdminMediaDetailDeleteView.as_view(), name='admin_album_media_delete'),

    # Client-facing album & download endpoints
    path('api/client/albums/<str:share_token>', views_s3.ClientPublicAlbumView.as_view(), name='client_album_view'),
    path('api/client/albums/<str:share_token>/media/<uuid:media_id>/download', views_s3.ClientDownloadMediaView.as_view(), name='client_album_media_download'),
    path('api/client/albums/<str:share_token>/media/<uuid:media_id>/preview', views_s3.ClientPreviewMediaView.as_view(), name='client_album_media_preview'),

    # Protected file delivery (X-Accel-Redirect)
    path('files/<str:kind>/<path:file_id>', ProtectedFileServeView.as_view(), name='protected_file_serve'),
]
