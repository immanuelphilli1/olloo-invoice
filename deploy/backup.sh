#!/usr/bin/env bash
# Nightly backup of the database and uploaded logos/signatures. Keeps 14 days.
# crontab -e (as the olloo user):
#   15 2 * * * /opt/olloo-invoice/deploy/backup.sh >> /var/log/olloo-backup.log 2>&1
# Copy /var/backups/olloo-invoice off the server too (e.g. rclone to Backblaze/Drive) —
# a backup on the same disk won't survive losing the VPS.
set -euo pipefail

BACKUP_DIR=/var/backups/olloo-invoice
UPLOAD_DIR=${UPLOAD_DIR:-/var/lib/olloo-invoice/uploads}
STAMP=$(date +%Y-%m-%d_%H%M)
set -a; source /opt/olloo-invoice/server/.env; set +a

mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --file="$BACKUP_DIR/db_$STAMP.dump" "$DATABASE_URL"
tar -czf "$BACKUP_DIR/uploads_$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db_$STAMP.dump"
