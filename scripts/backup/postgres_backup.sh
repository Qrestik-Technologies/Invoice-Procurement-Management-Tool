#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

CONTAINER="${POSTGRES_CONTAINER:-invoice-tool-postgresql-1}"
DB="${POSTGRES_DB:-invoice_tool}"
USER="${POSTGRES_USER:-postgres}"

OUT="$BACKUP_DIR/invoice_tool_${TIMESTAMP}.sql.gz"
docker exec "$CONTAINER" pg_dump -U "$USER" "$DB" | gzip > "$OUT"
echo "Backup written to $OUT"
