from django.urls import path
from .views import (
    ClientListCreateView,
    ClientDetailView,
    ClientPasskeyRegenerateView,
    ClientRestoreView
)

urlpatterns = [
    path('admin/clients', ClientListCreateView.as_view(), name='admin_client_list_create'),
    path('admin/clients/<uuid:pk>', ClientDetailView.as_view(), name='admin_client_detail'),
    path('admin/clients/<uuid:pk>/regenerate-passkey', ClientPasskeyRegenerateView.as_view(), name='admin_client_regenerate_passkey'),
    path('admin/clients/<uuid:pk>/restore', ClientRestoreView.as_view(), name='admin_client_restore'),
]
