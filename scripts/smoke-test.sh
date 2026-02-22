#!/bin/bash
# CSCX.AI Post-Deploy Smoke Test
# Usage: ./scripts/smoke-test.sh [BASE_URL]

set -euo pipefail

BASE_URL="${1:-https://cscx-api-938520514616.us-central1.run.app}"
PASS=0
FAIL=0
RESULTS=()

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null || echo "000")
  if [[ "$status" == "$expected_status" ]]; then
    RESULTS+=("  PASS  $name (HTTP $status)")
    PASS=$((PASS + 1))
  else
    RESULTS+=("  FAIL  $name (expected $expected_status, got $status)")
    FAIL=$((FAIL + 1))
  fi
}

echo "=== CSCX.AI Smoke Test ==="
echo "Target: $BASE_URL"
echo "Time:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

check "Health basic"          "$BASE_URL/health/basic"
check "Health full"           "$BASE_URL/health"
check "Health live"           "$BASE_URL/health/live"
check "Health ready"          "$BASE_URL/health/ready"
check "Customers list"        "$BASE_URL/api/customers"
check "Google OAuth connect"  "$BASE_URL/api/google/auth/connect"
check "Frontend loads"        "$BASE_URL/"

echo "--- Results ---"
for r in "${RESULTS[@]}"; do
  echo "$r"
done
echo ""
echo "Passed: $PASS  |  Failed: $FAIL  |  Total: $((PASS + FAIL))"
if [[ $FAIL -gt 0 ]]; then
  echo "SMOKE TEST FAILED"
  exit 1
else
  echo "SMOKE TEST PASSED"
  exit 0
fi
