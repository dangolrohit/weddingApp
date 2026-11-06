from django.urls import path
from .views import (
    PaymentListCreateView,
    PaymentDetailView,
    ClientPaymentsListView,
    PaymentSummaryView
)

urlpatterns = [
    path('admin/payments', PaymentListCreateView.as_view(), name='admin_payment_list_create'),
    path('admin/payments/summary', PaymentSummaryView.as_view(), name='admin_payment_summary'),
    path('admin/payments/<uuid:pk>', PaymentDetailView.as_view(), name='admin_payment_detail'),
    path('admin/clients/<uuid:client_pk>/payments', ClientPaymentsListView.as_view(), name='admin_client_payments'),
]

