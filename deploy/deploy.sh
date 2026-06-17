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

# Load env for this script (port + DEBEZIUM_* vars). Safe now values are quoted.
set -a; # shellcheck disable=SC1090
. "$ENV_FILE"; set +a

log "Pulling base images..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" pull --ignore-buildable || true

log "Building application images..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" build

log "Starting the stack..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d

log "Waiting for Postgres + Connect to be ready..."
sleep 10

# Kong is DB-less: it only reads kong.yml at start. `up -d` won't restart it when
# only the mounted file changed, so reload to pick up new routes (identity, users).
log "Reloading Kong declarative config..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" \
  exec -T kong kong reload >/dev/null 2>&1 && log "kong reloaded" || log "WARN: kong reload failed"

# Services with their own database (service:db). db push each (DB-per-service).
DB_SERVICES=( "platform-reference:${POSTGRES_DB:-livora}" "identity-service:identity" "user-service:users" )
# Databases that hold outbox tables (need the CDC publication).
OUTBOX_DBS=( "${POSTGRES_DB:-livora}" "identity" )

psql_super() {
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" \
    exec -T postgres psql -U "${POSTGRES_USER:-livora}" "$@"
}

log "Ensuring per-service databases..."
for entry in "${DB_SERVICES[@]}"; do
  db="${entry##*:}"
  if ! psql_super -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null | grep -q 1; then
    psql_super -d postgres -c "CREATE DATABASE \"${db}\"" >/dev/null 2>&1 && log "created db ${db}" || log "WARN: create db ${db} failed"
  fi
done

log "Syncing schemas (prisma db push) per service..."
# Local prisma CLI (pinned v5; never npx). Run as root (node_modules owned by root).
for entry in "${DB_SERVICES[@]}"; do
  svc="${entry%%:*}"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" \
    run --rm --no-deps --user root --entrypoint "" "$svc" \
    sh -lc './node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate' \
    >/dev/null 2>&1 && log "db push ok ($svc)" || log "WARN: db push failed ($svc)"
done

log "Ensuring CDC publications (FOR ALL TABLES)..."
for db in "${OUTBOX_DBS[@]}"; do
  psql_super -d "$db" -c "DROP PUBLICATION IF EXISTS livora_outbox; CREATE PUBLICATION livora_outbox FOR ALL TABLES;" \
    >/dev/null 2>&1 && log "publication ready ($db)" || log "WARN: publication failed ($db)"
done

log "Registering Debezium connectors..."
# Register every infra/debezium/*-connector.json from inside the network (Connect
# port is not host-published in prod). envsubst fills creds; python extracts config.
if command -v envsubst >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  for cj in infra/debezium/*-connector.json; do
    [ -f "$cj" ] || continue
    name="$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["name"])' "$cj")"
    cfg="$(envsubst < "$cj" | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["config"]))')"
    if printf '%s' "$cfg" | docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" \
        exec -T connect sh -c "curl -fsS -X PUT -H 'Content-Type: application/json' --data @- http://localhost:8083/connectors/${name}/config"; then
      echo; log "connector ${name} registered."
    else
      log "WARN: connector ${name} deferred."
    fi
  done
else
  log "WARN: envsubst/python3 missing on host — skipping connectors."
fi

log "Running health checks..."
ENV_FILE="$ENV_FILE" bash deploy/healthcheck.sh

log "Deploy complete. Proxy: http://localhost:${KONG_PROXY_PORT:-8000}/reference/health"
