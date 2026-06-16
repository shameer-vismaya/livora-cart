#!/usr/bin/env bash
# Deploy the Livora Cart stack to a single Docker host.
#
#   ./deploy/deploy.sh            # deploy on the current host
#   ./deploy/deploy.sh --remote   # rsync the repo to $DEPLOY_HOST and deploy over SSH
#
# Steps: pull/build images -> up -d -> run DB migrations -> register CDC -> health.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

ENV_FILE="${ENV_FILE:-deploy/.env.production}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
REMOTE=0
[ "${1:-}" = "--remote" ] && REMOTE=1

log() { printf '\033[36m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[deploy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "Missing $ENV_FILE (copy deploy/.env.production.example and fill it in)."

# ── Remote mode: ship the repo and run provision+deploy over SSH ───────────
if [ "$REMOTE" -eq 1 ]; then
  set -a; # shellcheck disable=SC1090
  . "$ENV_FILE"; set +a
  : "${DEPLOY_HOST:?set DEPLOY_HOST in $ENV_FILE}"
  : "${DEPLOY_USER:?set DEPLOY_USER in $ENV_FILE}"
  DEPLOY_PATH="${DEPLOY_PATH:-/opt/livora}"

  log "Syncing repo to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH} ..."
  ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "sudo mkdir -p '${DEPLOY_PATH}' && sudo chown ${DEPLOY_USER} '${DEPLOY_PATH}'"
  rsync -az --delete \
    --exclude node_modules --exclude .git --exclude dist --exclude .nx \
    ./ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

  log "Provisioning + deploying on the remote host..."
  ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "cd '${DEPLOY_PATH}' && bash deploy/provision-ubuntu.sh && ENV_FILE='${ENV_FILE}' bash deploy/deploy.sh"
  log "Remote deploy complete."
  exit 0
fi

# ── Local/on-host deploy ───────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker not found — run deploy/provision-ubuntu.sh first."

log "Pulling base images..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" pull --ignore-buildable || true

log "Building application images..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" build

log "Starting the stack..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d

log "Waiting for Postgres + Connect to be ready..."
sleep 10

log "Syncing database schema (prisma db push)..."
# Use the LOCAL prisma CLI (pinned v5 in the image) — never npx (which would
# download the latest major). No migration files yet this phase, so db push.
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" \
  run --rm --no-deps --entrypoint "" platform-reference \
  sh -lc './node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate' \
  || log "WARN: db push returned non-zero (will retry on next deploy)."

log "Registering Debezium outbox connector..."
ENV_FILE="$ENV_FILE" CONNECT_URL="http://localhost:${CONNECT_PORT:-8083}" \
  bash deploy/register-connector.sh || log "WARN: connector registration deferred."

log "Running health checks..."
ENV_FILE="$ENV_FILE" bash deploy/healthcheck.sh

log "Deploy complete. Proxy: http://localhost:${KONG_PROXY_PORT:-8000}/reference/health"
