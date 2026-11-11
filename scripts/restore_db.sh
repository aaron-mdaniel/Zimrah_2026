#!/usr/bin/env bash
# ==============================================================================
# ZIMRAH 2026 – PostgreSQL Database Disaster Recovery Script
# CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement
# ==============================================================================

set -o errexit
set -o pipefail
set -o nounset

if [ -z "${1:-}" ]; then
    echo "Usage: ./scripts/restore_db.sh <path_to_backup.dump>"
    echo "Example: ./scripts/restore_db.sh backups/zimrah_backup_20261111_080000.dump"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file '${BACKUP_FILE}' does not exist!"
    exit 1
fi

echo "==================================================================="
echo "WARNING: Restoring will overwrite existing data in the target database!"
echo "Target: ${DATABASE_URL:-$DB_NAME}"
echo "Backup File: ${BACKUP_FILE}"
echo "==================================================================="
read -p "Type 'RESTORE' to proceed: " CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
    echo "Aborted by user."
    exit 1
fi

echo "Starting database restoration..."

if [ -n "${DATABASE_URL:-}" ]; then
    pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}" "${BACKUP_FILE}"
elif [ -n "${DB_NAME:-}" ]; then
    PGPASSWORD="${DB_PASSWORD:-}" pg_restore -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" --clean --if-exists --no-owner --no-privileges -d "${DB_NAME}" "${BACKUP_FILE}"
else
    echo "ERROR: Neither DATABASE_URL nor DB_NAME is set!"
    exit 1
fi

echo "Restoration completed successfully!"
echo "Running Django migrations to verify schema integrity..."
python manage.py migrate --check
echo "Verification complete!"
