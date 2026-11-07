import os
from pathlib import Path
from datetime import timedelta
from celery.schedules import crontab

# Base Directory: /app (where manage.py is located)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Security Key
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'default-insecure-key-replace-in-production')

# Custom User Model (PRD Section 8)
AUTH_USER_MODEL = 'accounts.User'

# Application Definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local Domain Apps
    'apps.core',
    'apps.accounts',
    'apps.categories',
    'apps.clients',
    'apps.photos',
    'apps.delivery',
    'apps.site_settings',
    'apps.public_site',
    'apps.storage_stats',
    'apps.payments',
    'apps.equipment',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration (PostgreSQL with SQLite fallback for local test execution)
POSTGRES_DB = os.environ.get('POSTGRES_DB')
if POSTGRES_DB:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': POSTGRES_DB,
            'USER': os.environ.get('POSTGRES_USER', 'wedding_user'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'wedding_secure_password'),
            'HOST': os.environ.get('POSTGRES_HOST', 'db'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Password Validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static and Media Files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.environ.get('MEDIA_ROOT', BASE_DIR / 'media_data'))

# Fallback direct file serving for testing or standalone runs
SERVE_DIRECT_MEDIA = os.environ.get('SERVE_DIRECT_MEDIA', 'False').lower() in ('true', '1')

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
}

# SimpleJWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Celery & Redis Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_WORKER_CONCURRENCY = 2

import sys
if 'test' in sys.argv:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True

# Celery Beat Scheduled Tasks (Daily Cleanup, Expired Links, Trash Purge, Storage Recount)
CELERY_BEAT_SCHEDULE = {
    'daily-cleanup-job': {
        'task': 'apps.delivery.tasks.daily_cleanup_task',
        'schedule': crontab(hour=2, minute=0), # Run daily at 02:00 AM UTC
    },
    'nightly-storage-recalculation': {
        'task': 'apps.storage_stats.tasks.recalculate_storage_task',
        'schedule': crontab(hour=3, minute=0), # Run daily at 03:00 AM UTC
    },
    'nightly-upload-session-cleanup': {
        'task': 'apps.photos.tasks.cleanup_abandoned_uploads_task',
        'schedule': crontab(hour=4, minute=0), # Run daily at 04:00 AM UTC
    },
}

# Email Backend Settings
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Wedding Studio <notifications@weddingstudio.com>')
REPLY_TO_EMAIL = os.environ.get('REPLY_TO_EMAIL', 'contact@weddingstudio.com')

if not EMAIL_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Turnstile Settings
TURNSTILE_SITE_KEY = os.environ.get('TURNSTILE_SITE_KEY', '')
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY', '')

# S3 / MinIO / Garage Private Object Storage Settings
GARAGE_S3_USE_LOCAL_MOCK = os.environ.get('GARAGE_S3_USE_LOCAL_MOCK', '').lower() in ('true', '1', 'yes')
GARAGE_S3_ENDPOINT_URL = os.environ.get('S3_ENDPOINT_URL', os.environ.get('GARAGE_S3_ENDPOINT_URL', 'http://127.0.0.1:3900'))
GARAGE_S3_PUBLIC_URL = os.environ.get('S3_PUBLIC_URL', os.environ.get('GARAGE_S3_PUBLIC_URL', GARAGE_S3_ENDPOINT_URL))
GARAGE_S3_ACCESS_KEY_ID = os.environ.get('S3_ACCESS_KEY_ID', os.environ.get('GARAGE_S3_ACCESS_KEY_ID', 'garage_dev_key'))
GARAGE_S3_SECRET_ACCESS_KEY = os.environ.get('S3_SECRET_ACCESS_KEY', os.environ.get('GARAGE_S3_SECRET_ACCESS_KEY', 'garage_dev_secret'))
GARAGE_S3_REGION = os.environ.get('S3_REGION', os.environ.get('GARAGE_S3_REGION', 'us-east-1'))
GARAGE_S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', os.environ.get('GARAGE_S3_BUCKET_NAME', 'wedding-storage'))

