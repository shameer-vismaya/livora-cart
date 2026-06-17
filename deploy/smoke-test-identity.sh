#!/usr/bin/env bash
# Phase 2 smoke test: register -> login -> profile auto-created -> address -> RBAC.
set -uo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-deploy/.env.production}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

KONG="http://localhost:${KONG_PROXY_PORT:-8000}"
pass() { printf '\033[32m[smoke-id] PASS:\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[smoke-id] FAIL:\033[0m %s\n' "$*"; rc=1; }
rc=0

token_for() {
  curl -s -X POST "$KONG/realms/livora/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=livora-web \
    -d "username=$1" -d "password=$2" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

# unique email per run (no '+': it becomes a space in form-encoded login)
EMAIL="smoke-$(date +%s 2>/dev/null || echo x)-$RANDOM@livora.local"
PW="password1"

# 1. register (email)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KONG/identity/auth/register" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
if [ "$code" = "201" ]; then pass "register ($EMAIL)"; else fail "register expected 201 got $code"; fi

# 2. login as the new user
TOKEN=$(token_for "$EMAIL" "$PW")
if [ -n "$TOKEN" ]; then pass "login new user"; else fail "login new user"; fi

# 3. profile auto-created from UserRegistered (poll for eventual consistency)
ok=0
for _ in $(seq 1 10); do
  pcode=$(curl -s -o /dev/null -w '%{http_code}' "$KONG/users/profile/me" -H "Authorization: Bearer $TOKEN")
  [ "$pcode" = "200" ] && { ok=1; break; }
  sleep 2
done
[ "$ok" = "1" ] && pass "profile auto-created (UserRegistered -> user-service)" || fail "profile not created"

# 4. create an address (geocoded)
acode=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KONG/users/address" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"line1":"1 MG Rd","city":"Bengaluru","state":"KA","pincode":"560001","isDefault":true}')
[ "$acode" = "201" ] && pass "address created" || fail "address create expected 201 got $acode"

# 5. RBAC: admin route — customer 403, admin 200
ccode=$(curl -s -o /dev/null -w '%{http_code}' "$KONG/identity/admin/users" -H "Authorization: Bearer $TOKEN")
[ "$ccode" = "403" ] && pass "RBAC: customer denied (403)" || fail "RBAC customer expected 403 got $ccode"

ADMIN_TOKEN=$(token_for "testadmin" "admin_pw")
acode2=$(curl -s -o /dev/null -w '%{http_code}' "$KONG/identity/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN")
[ "$acode2" = "200" ] && pass "RBAC: admin allowed (200)" || fail "RBAC admin expected 200 got $acode2"

if [ "$rc" = "0" ]; then printf '\033[32m[smoke-id] ALL PASSED\033[0m\n'; else printf '\033[31m[smoke-id] FAILURES\033[0m\n'; fi
exit "$rc"
