#!/usr/bin/env bash
# ==============================================================================
# Wedding Photo Delivery Platform - Automated Backup Script
# Performs PostgreSQL database dump and archives platform media.
# Scheduled to run nightly via cron or Coolify task.
# ==============================================================================

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
KEEP_DAYS=7

mkdir -p "${TARGET_DIR}"

echo "=================================================="
echo "Starting Wedding Platform Backup: ${TIMESTAMP}"
echo "Target Directory: ${TARGET_DIR}"
echo "=================================================="

# 1. Backup PostgreSQL Database
echo "--> [1/3] Dumping PostgreSQL database..."
if docker compose ps db | grep -q "Up"; then
    docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-wedding_platform}" | gzip > "${TARGET_DIR}/database.sql.gz"
    echo "    Database dump created: ${TARGET_DIR}/database.sql.gz ($(du -sh "${TARGET_DIR}/database.sql.gz" | cut -f1))"
else
    echo "    WARNING: Database container is not running. Skipping DB dump."
fi

# 2. Archive Platform Media
echo "--> [2/3] Archiving media originals, showcase, and branding..."
MEDIA_DIR="${MEDIA_DIR:-./media_data}"
if [ -d "${MEDIA_DIR}" ]; then
    tar -czf "${TARGET_DIR}/media_archive.tar.gz" \
        --exclude='*/zips/*' \
        -C "${MEDIA_DIR}" \
        .
    echo "    Media archive created: ${TARGET_DIR}/media_archive.tar.gz ($(du -sh "${TARGET_DIR}/media_archive.tar.gz" | cut -f1))"
else
    echo "    WARNING: Media directory ${MEDIA_DIR} not found. Skipping media backup."
fi

# 3. Prune Old Backups (> 7 days)
echo "--> [3/3] Pruning backups older than ${KEEP_DAYS} days..."
find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -mtime +${KEEP_DAYS} -exec rm -rf {} +
echo "    Old backups cleaned."

echo "=================================================="
echo "Backup Completed Successfully at $(date)"
echo "=================================================="
