#!/usr/bin/env sh
# Restore a backup made by scripts/backup.sh into the Docker deployment.
#
#   sh scripts/restore.sh backups/erp-db-<date>.sql.gz [backups/erp-media-<date>.tar.gz]
#
# This REPLACES the current database (and the uploaded files, if the second
# file is given). It asks before doing anything; set YES=1 to skip the question.
set -eu

DB_FILE="${1:?Give the database backup file, e.g. backups/erp-db-20261002-020000.sql.gz}"
MEDIA_FILE="${2:-}"
[ -f "$DB_FILE" ] || { echo "Not found: $DB_FILE" >&2; exit 1; }
[ -z "$MEDIA_FILE" ] || [ -f "$MEDIA_FILE" ] || { echo "Not found: $MEDIA_FILE" >&2; exit 1; }

if [ "${YES:-0}" != "1" ]; then
  printf 'This replaces the current database with %s. Type "restore" to continue: ' "$DB_FILE"
  read -r answer
  [ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }
fi

echo "Stopping the app so nothing writes during the restore..."
docker compose stop backend app

echo "Restoring the database..."
docker compose exec -T db psql -U erp -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS erp WITH (FORCE);" -c "CREATE DATABASE erp OWNER erp;"
gunzip -c "$DB_FILE" | docker compose exec -T db psql -U erp -d erp -v ON_ERROR_STOP=1 -q

docker compose start backend
if [ -n "$MEDIA_FILE" ]; then
  echo "Restoring uploaded files..."
  docker compose exec -T backend sh -c 'rm -rf /app/media/* && tar -xzf - -C /app' < "$MEDIA_FILE"
fi
docker compose start app

echo "Restored. Open the site and check a few records."
