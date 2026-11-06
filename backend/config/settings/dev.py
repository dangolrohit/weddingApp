from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

# In dev, allow direct media file fallback if accessed without nginx
SERVE_DIRECT_MEDIA = True

