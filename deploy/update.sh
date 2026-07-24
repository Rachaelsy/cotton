#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  git fetch origin main
  git pull --ff-only origin main
fi

# Git does not move ignored files during the first directory migration.
if [ ! -f cotton-app/server/.env ]; then
  if [ -f server/.env ]; then
    mkdir -p cotton-app/server
    cp server/.env cotton-app/server/.env
    echo "[deploy] migrated server/.env to cotton-app/server/.env"
  else
    echo "[deploy] missing cotton-app/server/.env" >&2
    exit 1
  fi
fi

if [ ! -f .env ]; then
  if [ -f cotton-app/.env ]; then
    cp cotton-app/.env .env
    echo "[deploy] restored the root Compose .env"
  else
    echo "[deploy] missing root .env; create it from .env.example" >&2
    exit 1
  fi
fi

for cert in apiclient_key.pem pub_key.pem; do
  if [ ! -f "$cert" ] && [ -f "cotton-app/$cert" ]; then
    cp "cotton-app/$cert" "$cert"
    chmod 600 "$cert"
    echo "[deploy] restored $cert at the repository root"
  fi
done

docker compose config --quiet
docker compose up -d --build --remove-orphans
docker compose ps

check_url() {
  name="$1"
  url="$2"
  attempts=0
  until curl --fail --silent --show-error "$url" >/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "[deploy] $name health check failed: $url" >&2
      docker compose logs --tail=120 app community nginx
      exit 1
    fi
    sleep 2
  done
  echo "[deploy] $name is healthy"
}

check_url "cotton-app" "http://127.0.0.1/api/ping"
check_url "cotton-community" "http://127.0.0.1/api/community-health"
echo "[deploy] update completed"
