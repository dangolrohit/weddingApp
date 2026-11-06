from django.urls import path
from .views import CategoryListView, CategoryDetailView

urlpatterns = [
    path('admin/categories', CategoryListView.as_view(), name='admin_category_list'),
    path('admin/categories/<uuid:pk>', CategoryDetailView.as_view(), name='admin_category_detail'),
]

