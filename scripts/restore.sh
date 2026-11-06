#!/usr/bin/env bash
# ==============================================================================
# Wedding Photo Delivery Platform - Disaster Recovery Restore Script
# Restores PostgreSQL database and media files from a designated backup directory.
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_directory>"
    echo "Example: $0 ./backups/20261106_120000"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "ERROR: Backup directory '${BACKUP_DIR}' does not exist."
    exit 1
fi

echo "=================================================="
echo "Starting Disaster Recovery Restore"
echo "Source Archive: ${BACKUP_DIR}"
echo "=================================================="

# 1. Restore Database
DB_FILE="${BACKUP_DIR}/database.sql.gz"
if [ -f "${DB_FILE}" ]; then
    echo "--> [1/4] Restoring PostgreSQL database from ${DB_FILE}..."
    gunzip -c "${DB_FILE}" | docker compose exec -T db psql -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-wedding_platform}"
    echo "    Database restored successfully."
else
    echo "    WARNING: Database archive ${DB_FILE} not found."
fi

# 2. Restore Media Files
MEDIA_ARCHIVE="${BACKUP_DIR}/media_archive.tar.gz"
MEDIA_DIR="${MEDIA_DIR:-./media_data}"
if [ -f "${MEDIA_ARCHIVE}" ]; then
    echo "--> [2/4] Restoring media assets into ${MEDIA_DIR}..."
    mkdir -p "${MEDIA_DIR}"
    tar -xzf "${MEDIA_ARCHIVE}" -C "${MEDIA_DIR}"
    echo "    Media files unpacked successfully."
else
    echo "    WARNING: Media archive ${MEDIA_ARCHIVE} not found."
fi

# 3. Apply Any Pending Migrations
echo "--> [3/4] Running schema migrations..."
docker compose exec -T backend python manage.py migrate

# 4. Storage Re-synchronization
echo "--> [4/4] Recalculating storage usage..."
docker compose exec -T backend python manage.py shell -c "from apps.storage_stats.tasks import recalculate_storage_task; recalculate_storage_task()"

echo "=================================================="
echo "Platform Recovery Completed Successfully at $(date)"
echo "=================================================="

