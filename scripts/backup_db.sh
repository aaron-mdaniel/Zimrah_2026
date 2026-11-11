#!/usr/bin/env bash
# ==============================================================================
# ZIMRAH 2026 – Automated PostgreSQL Backup Script
# CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement
# ==============================================================================

set -o errexit
set -o pipefail
set -o nounset

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/zimrah_backup_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[${TIMESTAMP}] Starting ZIMRAH 2026 database backup..." | tee -a "${LOG_FILE}"

if [ -n "${DATABASE_URL:-}" ]; then
    echo "Backing up from DATABASE_URL..." | tee -a "${LOG_FILE}"
    pg_dump --format=custom --compress=9 --file="${BACKUP_FILE}" "${DATABASE_URL}"
elif [ -n "${DB_NAME:-}" ]; then
    echo "Backing up from DB_NAME=${DB_NAME} at ${DB_HOST:-127.0.0.1}..." | tee -a "${LOG_FILE}"
    PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" --format=custom --compress=9 --file="${BACKUP_FILE}" "${DB_NAME}"
else
    echo "ERROR: Neither DATABASE_URL nor DB_NAME is set!" | tee -a "${LOG_FILE}"
    exit 1
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date +"%Y%m%d_%H%M%S")] Backup completed successfully: ${BACKUP_FILE} (${FILE_SIZE})" | tee -a "${LOG_FILE}"

# Retention policy: Remove backups older than 14 days
find "${BACKUP_DIR}" -name "zimrah_backup_*.dump" -mtime +14 -exec rm -f {} \;
echo "Pruned backups older than 14 days." | tee -a "${LOG_FILE}"
