#!/usr/bin/env bash
# Verify the stack via Docker container health (decoupled from host port
# publishing) plus one functional probe through Kong. Non-zero exit on failure
# so deploy.sh fails loudly.
set -uo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-deploy/.env.production}"
if [ -f "$ENV_FILE" ]; then
  set -a; # shellcheck disable=SC1090
  . "$ENV_FILE"; set +a
fi

TIMEOUT="${HEALTH_TIMEOUT:-240}"
log() { printf '\033[36m[health]\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m[health] OK:\033[0m %s\n' "$*"; }
bad() { printf '\033[31m[health] FAIL:\033[0m %s\n' "$*"; }

# Containers WITH a Docker healthcheck — wait for "healthy".
HEALTHCHECKED=(
  livora-postgres livora-redis livora-kafka livora-schema-registry
  livora-connect livora-opensearch livora-keycloak livora-kong
  livora-minio livora-platform-reference
)
# Containers WITHOUT a healthcheck — just require "running".
RUNNING_ONLY=(
  livora-otel-collector livora-prometheus livora-tempo
  livora-grafana livora-opensearch-dashboards
)

state()  { docker inspect -f '{{.State.Status}}' "$1" 2>/dev/null || echo "missing"; }
health() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || echo "missing"; }

wait_healthy() {
  local name="$1" deadline=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    case "$(health "$name")" in
      healthy) ok "$name (healthy)"; return 0 ;;
      unhealthy) bad "$name (unhealthy)"; return 1 ;;
    esac
    sleep 4
  done
  bad "$name (timeout, last=$(health "$name"))"; return 1
}

wait_running() {
  local name="$1" deadline=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    [ "$(state "$name")" = "running" ] && { ok "$name (running)"; return 0; }
    sleep 4
  done
  bad "$name (not running, last=$(state "$name"))"; return 1
}

command -v docker >/dev/null 2>&1 || { bad "docker not found"; exit 1; }

log "Waiting for healthchecked containers (timeout ${TIMEOUT}s)..."
rc=0
for c in "${HEALTHCHECKED[@]}"; do wait_healthy "$c" || rc=1; done
for c in "${RUNNING_ONLY[@]}"; do wait_running "$c" || rc=1; done

# Functional probe through the public Kong proxy.
KONG="http://localhost:${KONG_PROXY_PORT:-8000}/reference/health"
log "Probing reference service via Kong: $KONG"
if curl -fsS -o /dev/null "$KONG"; then ok "kong -> platform-reference /health"; else bad "kong -> platform-reference /health"; rc=1; fi

log "Compose status:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps || true

if [ "$rc" -eq 0 ]; then ok "all checks passed"; else bad "one or more checks failed"; fi
exit "$rc"
