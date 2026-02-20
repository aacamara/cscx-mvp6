#!/bin/bash
# CSCX.AI Post-Deploy Smoke Test
# Usage: ./scripts/smoke-test.sh [BASE_URL]
BASE_URL="${1:-http://localhost:3001}"
PASS=0; FAIL=0

check() {
  local name="$1" url="$2" expected="$3"
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$response" = "$expected" ]; then
    echo "✅ $name ($response)"
    PASS=$((PASS + 1))
  else
    echo "❌ $name (got $response, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke Testing: $BASE_URL"
echo "================================"
echo ""

echo "--- Health Endpoints ---"
check "Health Live" "$BASE_URL/health/live" "200"
check "Health Ready" "$BASE_URL/health/ready" "200"
check "Health Full" "$BASE_URL/health" "200"

echo ""
echo "--- Auth Endpoints ---"
check "API Auth" "$BASE_URL/api/auth/status" "200"

echo ""
echo "--- Protected Endpoints (expect 401) ---"
check "API Customers" "$BASE_URL/api/customers" "401"
check "API Support" "$BASE_URL/api/support/tickets" "401"
check "API NPS" "$BASE_URL/api/nps/responses" "401"
check "API Feedback" "$BASE_URL/api/feedback" "401"
check "API Playbooks" "$BASE_URL/api/playbooks" "401"
check "API Automations" "$BASE_URL/api/automations" "401"

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
