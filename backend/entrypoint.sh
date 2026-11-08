#!/bin/sh
set -e

echo "Waiting for PostgreSQL database at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
while ! python -c "
import socket
import sys
import os

host = os.environ.get('POSTGRES_HOST', 'db')
port = int(os.environ.get('POSTGRES_PORT', 5432))
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect((host, port))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
  sleep 1
done
echo "PostgreSQL port is reachable! Verifying database authentication..."
python -c "
import sys, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings.prod'))
import django; django.setup()
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1;')
    print('PostgreSQL authentication successful!')
except Exception as e:
    print(f'[DATABASE AUTH ERROR] Failed to authenticate with database: {e}', file=sys.stderr)
    print(f'[DATABASE AUTH ERROR] Checked settings: USER={connection.settings_dict.get(\"USER\")}, NAME={connection.settings_dict.get(\"NAME\")}, HOST={connection.settings_dict.get(\"HOST\")}', file=sys.stderr)
    sys.exit(1)
"

# Run migrations and static collection only if starting the main backend web server
if [ "$1" = "gunicorn" ]; then
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    echo "Collecting static files..."
    python manage.py collectstatic --noinput

    echo "Initializing default admin account if not already created..."
    python manage.py initadmin || echo "Admin init notice: account may already exist."

    echo "Ensuring S3 storage bucket exists..."
    python -c "
import sys, os
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings.prod'))
import django; django.setup()
try:
    from apps.photos.services.s3_storage import ensure_bucket_exists
    ensure_bucket_exists()
except Exception as e:
    print('S3 bucket check notice:', e)
" || echo "S3 bucket verification completed."
fi

exec "$@"

