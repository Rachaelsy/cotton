#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

BACKUP_ROOT=${BACKUP_ROOT:-"$ROOT_DIR/backups"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
STAMP=$(date '+%Y%m%d_%H%M%S')
TARGET="$BACKUP_ROOT/$STAMP"

case "$BACKUP_ROOT" in
  "$ROOT_DIR/backups"|/var/backups/cotton) ;;
  *)
    echo "[backup] BACKUP_ROOT must be $ROOT_DIR/backups or /var/backups/cotton" >&2
    exit 1
    ;;
esac

mkdir -p "$TARGET"
chmod 700 "$TARGET"

echo "[backup] exporting MySQL"
docker compose exec -T db sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --events "$MYSQL_DATABASE"' \
  | gzip -9 > "$TARGET/mysql.sql.gz"

echo "[backup] archiving uploaded files"
docker compose exec -T app tar -czf - -C /app/public/uploads . > "$TARGET/app-uploads.tar.gz"
docker compose exec -T app tar -czf - -C /app/private/identity . > "$TARGET/identity-uploads.tar.gz"
docker compose exec -T app tar -czf - -C /app/private/applyments . > "$TARGET/applyment-uploads.tar.gz"
docker compose exec -T community tar -czf - -C /app/public/uploads . > "$TARGET/community-uploads.tar.gz"

echo "[backup] archiving runtime configuration"
CONFIG_PATHS=".env cotton-app/server/.env"
for item in apiclient_key.pem pub_key.pem; do
  if [ -f "$item" ]; then CONFIG_PATHS="$CONFIG_PATHS $item"; fi
done
# shellcheck disable=SC2086
tar -czf "$TARGET/runtime-config.tar.gz" $CONFIG_PATHS
chmod 600 "$TARGET/runtime-config.tar.gz"

gzip -t "$TARGET/mysql.sql.gz"
tar -tzf "$TARGET/app-uploads.tar.gz" >/dev/null
tar -tzf "$TARGET/identity-uploads.tar.gz" >/dev/null
tar -tzf "$TARGET/applyment-uploads.tar.gz" >/dev/null
tar -tzf "$TARGET/community-uploads.tar.gz" >/dev/null
tar -tzf "$TARGET/runtime-config.tar.gz" >/dev/null

(cd "$TARGET" && sha256sum *.gz > SHA256SUMS)
chmod 600 "$TARGET"/*

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf -- {} +

echo "[backup] completed: $TARGET"
echo "[backup] copy this directory to protected off-server storage"
