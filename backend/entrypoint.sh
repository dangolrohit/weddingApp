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
echo "PostgreSQL is reachable!"

# Run migrations and static collection only if starting the main backend web server
if [ "$1" = "gunicorn" ]; then
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    echo "Collecting static files..."
    python manage.py collectstatic --noinput

    echo "Initializing default admin account if not already created..."
    python manage.py initadmin
fi

exec "$@"

