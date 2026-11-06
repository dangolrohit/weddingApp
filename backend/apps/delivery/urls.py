from django.urls import path
from .views import (
    GetMyImageVerifyView,
    GetMyImagePhotosView,
    GetMyImageRequestLinkView
)

urlpatterns = [
    path('public/get-my-image/verify', GetMyImageVerifyView.as_view(), name='client_verify'),
    path('public/get-my-image/photos', GetMyImagePhotosView.as_view(), name='client_photos_preview'),
    path('public/get-my-image/request-link', GetMyImageRequestLinkView.as_view(), name='client_request_link'),
]
