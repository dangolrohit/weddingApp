from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

# In dev, allow direct media file fallback if accessed without nginx
SERVE_DIRECT_MEDIA = True

# Eager Celery execution when running local dev without Docker/Redis
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True


