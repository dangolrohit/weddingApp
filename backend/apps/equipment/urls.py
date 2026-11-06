from django.urls import path
from .views import (
    EquipmentListCreateView,
    EquipmentDetailView,
    EquipmentSummaryView
)

urlpatterns = [
    path('admin/equipment', EquipmentListCreateView.as_view(), name='admin_equipment_list_create'),
    path('admin/equipment/summary', EquipmentSummaryView.as_view(), name='admin_equipment_summary'),
    path('admin/equipment/<uuid:pk>', EquipmentDetailView.as_view(), name='admin_equipment_detail'),
]

