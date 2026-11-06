from django.urls import path
from .views import (
    StorageOverviewView,
    StorageRecalculateView,
    StorageClearZipsView
)

urlpatterns = [
    path('admin/storage', StorageOverviewView.as_view(), name='admin_storage_overview'),
    path('admin/storage/recalculate', StorageRecalculateView.as_view(), name='admin_storage_recalculate'),
    path('admin/storage/clear-zips', StorageClearZipsView.as_view(), name='admin_storage_clear_zips'),
]
