from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, LogoutView, CurrentUserView, PasswordChangeView

urlpatterns = [
    path('auth/login', LoginView.as_view(), name='auth_login'),
    path('auth/refresh', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/logout', LogoutView.as_view(), name='auth_logout'),
    path('auth/me', CurrentUserView.as_view(), name='auth_me'),
    path('admin/password', PasswordChangeView.as_view(), name='admin_password_change'),
]

