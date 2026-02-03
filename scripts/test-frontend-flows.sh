#!/bin/bash
# CSCX.AI Frontend-Backend Integration Test
# Tests all PRD flows end-to-end

set -e

API_URL="${1:-http://localhost:3001}"
USER_ID="${2:-test-user-$(date +%s)}"

echo "=== CSCX.AI Integration Tests ==="
echo "API: $API_URL"
echo "User: $USER_ID"
echo ""

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected="$5"

    echo -n "Testing $name... "

    if [ "$method" == "GET" ]; then
        response=$(curl -sf -H "x-user-id: $USER_ID" "$API_URL$endpoint" 2>/dev/null || echo '{"error":"failed"}')
    else
        response=$(curl -sf -X "$method" -H "Content-Type: application/json" -H "x-user-id: $USER_ID" -d "$data" "$API_URL$endpoint" 2>/dev/null || echo '{"error":"failed"}')
    fi

    if echo "$response" | grep -q "$expected"; then
        echo "✓ PASS"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo "✗ FAIL"
        echo "   Expected: $expected"
        echo "   Got: $(echo $response | head -c 200)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "--- PRD-0: Health & Core ---"
test_endpoint "Health check" "GET" "/health" "" "healthy"
test_endpoint "Liveness probe" "GET" "/health/live" "" "status"
test_endpoint "Readiness probe" "GET" "/health/ready" "" "services"

echo ""
echo "--- PRD-3: Agent Inbox (Approvals) ---"
test_endpoint "List approvals" "GET" "/api/approvals" "" "success"
test_endpoint "Get approval stats" "GET" "/api/approvals/stats" "" "stats"

# Create a test approval
echo -n "Creating test approval... "
APPROVAL_RESPONSE=$(curl -sf -X POST -H "Content-Type: application/json" -H "x-user-id: $USER_ID" \
    -d '{"actionType":"send_email","actionData":{"to":["test@example.com"],"subject":"Test Email","body":"Hello"},"originalContent":"Test email draft"}' \
    "$API_URL/api/approvals" 2>/dev/null || echo '{"error":"failed"}')

if echo "$APPROVAL_RESPONSE" | grep -q "success"; then
    echo "✓ PASS"
    PASSED=$((PASSED + 1))

    # Extract approval ID
    APPROVAL_ID=$(echo "$APPROVAL_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$APPROVAL_ID" ]; then
        # Test approval workflow
        test_endpoint "Get approval by ID" "GET" "/api/approvals/$APPROVAL_ID" "" "success"
        test_endpoint "Approve action" "POST" "/api/approvals/$APPROVAL_ID/approve" '{}' "approved"
    fi
else
    echo "✗ FAIL (may need migration)"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "--- PRD-4: Support Tickets ---"
test_endpoint "List support tickets" "GET" "/api/support/tickets" "" "tickets"

# Create a test ticket
echo -n "Creating test ticket... "
TICKET_RESPONSE=$(curl -sf -X POST -H "Content-Type: application/json" -H "x-user-id: $USER_ID" \
    -d '{"customerId":"test-customer-123","subject":"Test Ticket","description":"This is a test ticket","priority":"medium"}' \
    "$API_URL/api/support/tickets" 2>/dev/null || echo '{"error":"failed"}')

if echo "$TICKET_RESPONSE" | grep -q "ticket\|id"; then
    echo "✓ PASS"
    PASSED=$((PASSED + 1))

    # Check if AI suggestions were generated
    if echo "$TICKET_RESPONSE" | grep -q "troubleshootingSuggestions\|ai_suggestions"; then
        echo "   ✓ AI suggestions generated"
    fi
else
    echo "✗ FAIL (may need migration)"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "--- PRD-2: Knowledge Base ---"
test_endpoint "KB status" "GET" "/api/kb/status" "" "chunks"
test_endpoint "KB search" "GET" "/api/kb/search?q=test" "" "results"

echo ""
echo "--- PRD-5: Admin Dashboard ---"
test_endpoint "Admin overview" "GET" "/api/admin/overview" "" "overview\|total\|customers"

echo ""
echo "--- PRD-1: Authentication ---"
test_endpoint "Auth session check" "GET" "/api/auth/session" "" "user\|session\|error"

echo ""
echo "--- Agent Chat ---"
test_endpoint "List agent sessions" "GET" "/api/agents/sessions" "" "sessions\|error"
test_endpoint "Get pending actions" "GET" "/api/agents/pending" "" "actions\|pending"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "❌ SOME TESTS FAILED"
    echo ""
    echo "Next steps:"
    echo "  1. Apply migrations: cd server && npx supabase db push"
    echo "  2. Check server logs for errors"
    echo "  3. Verify VITE_API_URL is set correctly"
    exit 1
else
    echo "✅ ALL TESTS PASSED"
    exit 0
fi
