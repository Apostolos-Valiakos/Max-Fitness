#!/usr/bin/env bash
# Daily Postgres dump, retained locally for RETENTION_DAYS. This alone is
# NOT a real backup strategy — see the go-live guide for copying dumps
# off-VPS (rsync/rclone to any object storage). A backup on the same disk
# as the live DB doesn't survive a disk failure.
#
# Cron example (2am daily):
#   0 2 * * * /path/to/repo/deploy/backup.sh >> /var/log/ferrum-backup.log 2>&1
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/deploy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

set -a
source supabase/.env
set +a

mkdir -p "$BACKUP_DIR"

docker compose -f supabase/docker-compose.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$BACKUP_DIR/ferrum-${TIMESTAMP}.dump"

echo "Wrote $BACKUP_DIR/ferrum-${TIMESTAMP}.dump"

find "$BACKUP_DIR" -name 'ferrum-*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "Restore with: docker compose -f supabase/docker-compose.yml exec -T db pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --clean --if-exists < <dump-file>"
