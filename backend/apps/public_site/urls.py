from django.urls import path
from .views import (
    PublicCategoriesView,
    PublicShowcaseView,
    PublicBrandingView,
    PublicInquiryCreateView
)

urlpatterns = [
    path('categories', PublicCategoriesView.as_view(), name='public_categories'),
    path('showcase', PublicShowcaseView.as_view(), name='public_showcase'),
    path('branding', PublicBrandingView.as_view(), name='public_branding'),
    path('inquiries', PublicInquiryCreateView.as_view(), name='public_inquiries'),
]
