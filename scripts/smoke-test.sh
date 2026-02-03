#!/bin/bash
# CSCX.AI Smoke Test Script
# Usage: ./scripts/smoke-test.sh [BASE_URL]

set -e

BASE_URL="${1:-https://cscx-api-938520514616.us-central1.run.app}"

echo "=== CSCX.AI Smoke Tests ==="
echo "Testing: $BASE_URL"
echo ""

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_code="${3:-200}"

    echo -n "Testing $name... "

    response=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "000")

    if [ "$response" == "$expected_code" ]; then
        echo "✓ PASS ($response)"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAIL (got $response, expected $expected_code)"
        FAILED=$((FAILED + 1))
    fi
}

test_json_endpoint() {
    local name="$1"
    local endpoint="$2"
    local json_key="$3"

    echo -n "Testing $name... "

    response=$(curl -sf "$BASE_URL$endpoint" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e ".$json_key" > /dev/null 2>&1; then
        echo "✓ PASS"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAIL (missing $json_key)"
        FAILED=$((FAILED + 1))
    fi
}

echo "--- Health Endpoints ---"
test_endpoint "GET /health" "/health"
test_endpoint "GET /health/live" "/health/live"
test_endpoint "GET /health/ready" "/health/ready"
test_json_endpoint "Health status field" "/health" "status"
test_json_endpoint "Services status" "/health/ready" "services"

echo ""
echo "--- API Endpoints ---"
test_endpoint "GET /api/actions" "/api/actions"
test_endpoint "GET /api/approvals" "/api/approvals"
test_endpoint "GET /api/kb/status" "/api/kb/status"
test_endpoint "GET /api/admin/overview (unauth)" "/api/admin/overview" "401"

echo ""
echo "--- PRD Verification ---"
test_json_endpoint "KB chunks count" "/api/kb/status" "chunks"
test_json_endpoint "Actions endpoint" "/api/actions" "actions"
test_json_endpoint "Approvals endpoint" "/api/approvals" "policies"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "❌ SMOKE TESTS FAILED"
    exit 1
else
    echo "✅ ALL SMOKE TESTS PASSED"
    exit 0
fi
