#!/usr/bin/env bash
# Render Build Script for ZIMRAH 2026 Production Deployment
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> [1/5] Upgrading pip and installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> [2/5] Collecting static assets with WhiteNoise compression..."
python manage.py collectstatic --no-input

echo "==> [3/5] Applying PostgreSQL database migrations..."
python manage.py migrate --no-input

echo "==> [4/5] Seeding master event data & categories (if not already seeded)..."
python manage.py seed_master_data

echo "==> [5/5] Checking for automated Super Admin initialization..."
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "Creating or updating production Super Admin..."
    python manage.py create_prod_admin
else
    echo "ADMIN_PASSWORD not set; skipping automated super admin creation."
fi

echo "==> ZIMRAH 2026 Build and Preparation Completed Successfully!"
