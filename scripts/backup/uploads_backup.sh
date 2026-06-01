#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups/uploads}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

VOLUME="${UPLOADS_VOLUME:-uploads_data}"
ARCHIVE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"

docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine \
  tar -czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /data .

echo "Backup written to $ARCHIVE"
