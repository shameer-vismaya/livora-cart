#!/usr/bin/env bash
# Poll the stack until all services are healthy (or time out). Exit non-zero on
# failure so deploy.sh fails loudly.
set -uo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-deploy/.env.production}"
if [ -f "$ENV_FILE" ]; then
  set -a; # shellcheck disable=SC1090
  . "$ENV_FILE"; set +a
fi

TIMEOUT="${HEALTH_TIMEOUT:-180}"
log() { printf '\033[36m[health]\033[0m %s\n' "$*"; }
ok() { printf '\033[32m[health] OK:\033[0m %s\n' "$*"; }
bad() { printf '\033[31m[health] FAIL:\033[0m %s\n' "$*"; }

# name|url pairs to probe via HTTP.
PROBES=(
  "kong|http://localhost:${KONG_PROXY_PORT:-8000}/reference/health/live"
  "keycloak|http://localhost:${KEYCLOAK_PORT:-8080}/realms/livora/.well-known/openid-configuration"
  "opensearch|http://localhost:${OPENSEARCH_PORT:-9200}/_cluster/health"
  "schema-registry|http://localhost:${SCHEMA_REGISTRY_PORT:-8081}/subjects"
  "connect|http://localhost:${CONNECT_PORT:-8083}/connectors"
  "prometheus|http://localhost:${PROMETHEUS_PORT:-9090}/-/ready"
  "grafana|http://localhost:${GRAFANA_PORT:-3001}/api/health"
  "platform-reference|http://localhost:${PLATFORM_REFERENCE_PORT:-3000}/health/ready"
  "minio|http://localhost:${MINIO_API_PORT:-9000}/minio/health/ready"
)

wait_for() {
  local name="$1" url="$2" deadline=$(( $(date +%s) + TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS -o /dev/null "$url"; then ok "$name"; return 0; fi
    sleep 3
  done
  bad "$name ($url)"
  return 1
}

log "Probing services (timeout ${TIMEOUT}s each)..."
rc=0
for entry in "${PROBES[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  wait_for "$name" "$url" || rc=1
done

# Also surface compose-level health for anything with a healthcheck.
if command -v docker >/dev/null 2>&1; then
  log "Compose status:"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml ps || true
fi

if [ "$rc" -eq 0 ]; then ok "all probes passed"; else bad "one or more services unhealthy"; fi
exit "$rc"
