#!/usr/bin/env sh
# Back up the Docker deployment: the database and the uploaded documents.
#
#   sh scripts/backup.sh [folder]        (default folder: ./backups)
#
# Run it from the project folder (next to docker-compose.yml). It writes
#   erp-db-<date>.sql.gz      the whole database
#   erp-media-<date>.tar.gz   the uploaded files
# and keeps the newest KEEP of each (default 14). Copy the folder somewhere
# off this machine as well; a backup on the same disk is not a backup.
set -eu

DIR="${1:-./backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

echo "Backing up the database..."
docker compose exec -T db pg_dump -U erp -d erp --no-owner | gzip > "$DIR/erp-db-$STAMP.sql.gz"

echo "Backing up uploaded files..."
docker compose exec -T backend tar -czf - -C /app media > "$DIR/erp-media-$STAMP.tar.gz"

# A dump that is nearly empty means something went wrong
SIZE="$(wc -c < "$DIR/erp-db-$STAMP.sql.gz")"
if [ "$SIZE" -lt 1000 ]; then
  echo "The database backup is only $SIZE bytes. Check that the stack is running." >&2
  exit 1
fi

for kind in db media; do
  ls -1t "$DIR"/erp-$kind-* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f "$old"; done
done

echo "Done: $DIR/erp-db-$STAMP.sql.gz and $DIR/erp-media-$STAMP.tar.gz"
