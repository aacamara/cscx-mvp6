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

# Check route is mounted (any response except 404)
check_mounted() {
  local name="$1" url="$2"
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$response" != "404" ]; then
    echo "✅ $name ($response)"
    PASS=$((PASS + 1))
  else
    echo "❌ $name (404 — route not mounted)"
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
check "Auth Session (no token)" "$BASE_URL/api/auth/session" "401"

echo ""
echo "--- API Routes Mounted ---"
check_mounted "Customers" "$BASE_URL/api/customers"
check_mounted "Support Tickets" "$BASE_URL/api/support/tickets"
check_mounted "NPS Responses" "$BASE_URL/api/nps/responses"
check_mounted "Feedback" "$BASE_URL/api/feedback"
check_mounted "Playbooks" "$BASE_URL/api/playbooks"
check_mounted "Automations" "$BASE_URL/api/automations"
check_mounted "Support Metrics" "$BASE_URL/api/support-metrics"
check_mounted "Email Suggestions" "$BASE_URL/api/email-suggestions/stakeholder"

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
