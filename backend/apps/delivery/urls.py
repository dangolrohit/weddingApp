from django.urls import path
from .views import (
    GetMyImageVerifyView,
    GetMyImagePhotosView,
    GetMyImageRequestLinkView,
    AdminClientSendLinkView,
    AdminClientLinksView,
    AdminRevokeLinkView,
    PublicDownloadStatusView,
    PublicDownloadPartView
)

urlpatterns = [
    # Public Get My Image verification & session
    path('public/get-my-image/verify', GetMyImageVerifyView.as_view(), name='client_verify'),
    path('public/get-my-image/photos', GetMyImagePhotosView.as_view(), name='client_photos_preview'),
    path('public/get-my-image/request-link', GetMyImageRequestLinkView.as_view(), name='client_request_link'),

    # Public download portal /d/{token}
    path('d/<str:token>', PublicDownloadStatusView.as_view(), name='public_download_status'),
    path('d/<str:token>/part/<int:part_no>', PublicDownloadPartView.as_view(), name='public_download_part'),

    # Admin Send & Link Management
    path('admin/clients/<uuid:client_id>/send-link', AdminClientSendLinkView.as_view(), name='admin_send_link'),
    path('admin/clients/<uuid:client_id>/links', AdminClientLinksView.as_view(), name='admin_client_links'),
    path('admin/links/<uuid:link_id>/revoke', AdminRevokeLinkView.as_view(), name='admin_revoke_link'),
]
