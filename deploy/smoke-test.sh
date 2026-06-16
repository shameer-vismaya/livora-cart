#!/usr/bin/env bash
# Post-deploy smoke test for the Phase 1 spine (platform-reference).
# Asserts: health -> token -> 401 without token -> 202 with token -> consumer applied.
set -uo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-deploy/.env.production}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

KONG="http://localhost:${KONG_PROXY_PORT:-8000}"
pass() { printf '\033[32m[smoke] PASS:\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[smoke] FAIL:\033[0m %s\n' "$*"; rc=1; }
rc=0

# 1. health via Kong
if curl -fsS -o /dev/null "$KONG/reference/health"; then pass "reference health"; else fail "reference health"; fi

# 2. token (password grant via Kong /realms)
TOKEN=$(curl -s -X POST "$KONG/realms/livora/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=livora-web \
  -d username=testcustomer -d password=test_pw \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then pass "obtained token"; else fail "obtain token"; fi

# 3. protected route without token -> 401
code=$(curl -s -o /dev/null -w '%{http_code}' "$KONG/reference/demo/echo")
if [ "$code" = "401" ]; then pass "no-token rejected (401)"; else fail "no-token expected 401 got $code"; fi

# 4. protected POST with token -> 202
KEY="smoke-$(date +%s 2>/dev/null || echo manual)-$RANDOM"
RESP=$(curl -s -w '\n%{http_code}' -X POST "$KONG/reference/demo/echo" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" -d '{"message":"smoke"}')
body=$(printf '%s' "$RESP" | head -n1)
code=$(printf '%s' "$RESP" | tail -n1)
EVENT_ID=$(printf '%s' "$body" | sed -n 's/.*"eventId":"\([^"]*\)".*/\1/p')
if [ "$code" = "202" ] && [ -n "$EVENT_ID" ]; then pass "authorized POST (202, event $EVENT_ID)"; else fail "authorized POST expected 202 got $code"; fi

# 5. consumer applied the event (poll up to ~20s)
applied=0
for _ in $(seq 1 10); do
  if docker logs livora-platform-reference 2>&1 | grep -q "applied event $EVENT_ID"; then applied=1; break; fi
  sleep 2
done
if [ "$applied" = "1" ]; then pass "consumer applied event (outbox->CDC->Kafka->consumer)"; else fail "consumer did not apply event $EVENT_ID"; fi

if [ "$rc" = "0" ]; then printf '\033[32m[smoke] ALL PASSED\033[0m\n'; else printf '\033[31m[smoke] FAILURES\033[0m\n'; fi
exit "$rc"
