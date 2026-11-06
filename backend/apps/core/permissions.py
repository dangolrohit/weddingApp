from rest_framework.permissions import BasePermission
from .utils import verify_client_session

class IsAdminUser(BasePermission):
    """Allows access only to authenticated and active admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)

class HasClientSession(BasePermission):
    """
    Allows access to clients who possess a valid 30-minute signed session token
    passed via the 'X-Client-Session' header or 'client_session' cookie.
    """
    def has_permission(self, request, view):
        token = request.headers.get('X-Client-Session') or request.COOKIES.get('client_session')
        if not token:
            return False
        client_id = verify_client_session(token)
        if not client_id:
            return False
        request.client_id = client_id
        return True

