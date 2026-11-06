from .base import *
import os

DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1')

allowed_hosts_str = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_str.split(',') if h.strip()]

cors_origins_str = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost,http://127.0.0.1')
CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_str.split(',') if o.strip()]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True

SERVE_DIRECT_MEDIA = os.environ.get('SERVE_DIRECT_MEDIA', 'False').lower() in ('true', '1')

