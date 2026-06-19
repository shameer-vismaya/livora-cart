#!/usr/bin/env bash
# Phase 3 smoke test: store onboarding -> approval -> catalog -> media -> publish
# -> tenant isolation. Uses seed users teststoreowner/teststoreowner2 + testadmin.
set -uo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-deploy/.env.production}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

KONG="http://localhost:${KONG_PROXY_PORT:-8000}"
pass() { printf '\033[32m[smoke-store] PASS:\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[smoke-store] FAIL:\033[0m %s\n' "$*"; rc=1; }
rc=0

login() {
  curl -s -X POST "$KONG/realms/livora/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=livora-web \
    -d "username=$1" -d "password=$2" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}
jget() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

ADMIN=$(login testadmin admin_pw)
OWNER=$(login teststoreowner owner_pw)
[ -n "$ADMIN" ] && [ -n "$OWNER" ] && pass "logins" || fail "logins"

# 1. owner applies for a store
APPLY=$(curl -s -X POST "$KONG/stores" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d '{"name":"Smoke Store"}')
STORE_ID=$(printf '%s' "$APPLY" | jget id)
[ -n "$STORE_ID" ] && pass "store applied ($STORE_ID, pending)" || fail "store apply: $APPLY"

# 2. admin approves
acode=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KONG/admin/stores/$STORE_ID/approve" -H "Authorization: Bearer $ADMIN")
[ "$acode" = "201" ] || [ "$acode" = "200" ] && pass "store approved" || fail "approve got $acode"

# 3. owner RE-LOGIN to pick up the new 'stores' claim
sleep 1
OWNER=$(login teststoreowner owner_pw)
# Decode the JWT payload with proper base64url padding (naive base64 -d fails).
if printf '%s' "$OWNER" | python3 -c "
import sys, base64, json
p = sys.stdin.read().strip().split('.')[1]
p += '=' * (-len(p) % 4)
claims = json.loads(base64.urlsafe_b64decode(p))
sys.exit(0 if '$STORE_ID' in (claims.get('stores') or []) else 1)
"; then
  pass "owner token carries stores claim"
else
  fail "stores claim missing from owner token"
fi

# 4. admin creates a category
CAT=$(curl -s -X POST "$KONG/catalog/categories" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d "{\"name\":\"Smoke Cat $(date +%s 2>/dev/null || echo x)$RANDOM\"}")
CAT_ID=$(printf '%s' "$CAT" | jget id)
[ -n "$CAT_ID" ] && pass "category created" || fail "category: $CAT"

# 5. owner creates a product in their store
PROD=$(curl -s -X POST "$KONG/catalog/stores/$STORE_ID/products" -H "Authorization: Bearer $OWNER" \
  -H 'Content-Type: application/json' -d "{\"title\":\"Smoke Product\",\"categoryId\":\"$CAT_ID\",\"gstRatePct\":18}")
PROD_ID=$(printf '%s' "$PROD" | jget id)
[ -n "$PROD_ID" ] && pass "product created" || fail "product: $PROD"

# 6. presign a media upload
pcode=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KONG/catalog/stores/$STORE_ID/products/$PROD_ID/media/presign" \
  -H "Authorization: Bearer $OWNER" -H 'Content-Type: application/json' -d '{"contentType":"image/jpeg"}')
[ "$pcode" = "201" ] || [ "$pcode" = "200" ] && pass "media presign" || fail "presign got $pcode"

# 7. submit + admin publish
curl -s -o /dev/null -X POST "$KONG/catalog/stores/$STORE_ID/products/$PROD_ID/submit" -H "Authorization: Bearer $OWNER"
mcode=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KONG/catalog/admin/products/$PROD_ID/approve" -H "Authorization: Bearer $ADMIN")
[ "$mcode" = "201" ] || [ "$mcode" = "200" ] && pass "product published" || fail "publish got $mcode"

# 8. tenant isolation: another owner cannot read store A's products
OWNER2=$(login teststoreowner2 owner_pw)
icode=$(curl -s -o /dev/null -w '%{http_code}' "$KONG/catalog/stores/$STORE_ID/products" -H "Authorization: Bearer $OWNER2")
[ "$icode" = "403" ] && pass "tenant isolation (owner2 -> 403)" || fail "isolation expected 403 got $icode"

# 9. ProductPublished on the catalog topic
sleep 4
if docker exec livora-kafka kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic livora.catalog.events --from-beginning --max-messages 1 --timeout-ms 8000 >/dev/null 2>&1; then
  pass "ProductPublished on livora.catalog.events"
else
  fail "no message on livora.catalog.events"
fi

if [ "$rc" = "0" ]; then printf '\033[32m[smoke-store] ALL PASSED\033[0m\n'; else printf '\033[31m[smoke-store] FAILURES\033[0m\n'; fi
exit "$rc"
