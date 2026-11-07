from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

# In dev, allow direct media file fallback if accessed without nginx
SERVE_DIRECT_MEDIA = True

# Eager Celery execution when running local dev without Docker/Redis
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# In dev mode, enable built-in S3 mock so uploads work locally without Docker or Ubuntu running
GARAGE_S3_USE_LOCAL_MOCK = os.environ.get('GARAGE_S3_USE_LOCAL_MOCK', 'true').lower() in ('true', '1', 'yes')
if GARAGE_S3_USE_LOCAL_MOCK:
    GARAGE_S3_ENDPOINT_URL = os.environ.get('GARAGE_S3_ENDPOINT_URL', 'http://127.0.0.1:8000/api/dev-s3')
    GARAGE_S3_PUBLIC_URL = os.environ.get('GARAGE_S3_PUBLIC_URL', 'http://127.0.0.1:8000/api/dev-s3')


