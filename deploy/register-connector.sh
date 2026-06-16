#!/usr/bin/env bash
# Register (idempotently) the Debezium outbox connector with Kafka Connect.
# Substitutes env vars into the connector JSON, then PUTs it (PUT = upsert).
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
CONNECT_URL="${CONNECT_URL:-http://localhost:8083}"
CONNECTOR_JSON="${CONNECTOR_JSON:-infra/debezium/outbox-connector.json}"
CONNECTOR_NAME="platform-reference-outbox"

log() { printf '\033[36m[connector]\033[0m %s\n' "$*"; }

# Load env (for DEBEZIUM_DB_* substitution).
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${DEBEZIUM_DB_USER:=debezium}"
: "${DEBEZIUM_DB_PASSWORD:=debezium_dev_pw}"
: "${DEBEZIUM_DB_NAME:=livora}"
export DEBEZIUM_DB_USER DEBEZIUM_DB_PASSWORD DEBEZIUM_DB_NAME

# Wait for Connect to be up.
log "Waiting for Kafka Connect at ${CONNECT_URL}..."
for _ in $(seq 1 30); do
  if curl -fsS "${CONNECT_URL}/connectors" >/dev/null 2>&1; then break; fi
  sleep 3
done

# Substitute env placeholders (${VAR}) in the connector config.
CONFIG_ONLY="$(envsubst < "$CONNECTOR_JSON" | sed -n 's/.*/&/p')"

log "Upserting connector '${CONNECTOR_NAME}'..."
# Use PUT /config for idempotent create-or-update.
echo "$CONFIG_ONLY" \
  | python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin)["config"]))' \
  | curl -fsS -X PUT \
      -H 'Content-Type: application/json' \
      --data @- \
      "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/config" >/dev/null

log "Connector registered. Status:"
curl -fsS "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/status" || true
echo
