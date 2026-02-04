#!/bin/bash
# CSCX.AI Test Runner
# Run this script to test all 48-hour features

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "🧪 CSCX.AI Test Suite"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if servers are running
check_servers() {
    echo "📡 Checking servers..."

    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Frontend running on http://localhost:3000"
    else
        echo -e "  ${RED}✗${NC} Frontend NOT running"
        echo "    Starting frontend..."
        cd "$PROJECT_DIR" && PORT=3000 npm run dev > /tmp/frontend.log 2>&1 &
        sleep 8
    fi

    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Backend running on http://localhost:3001"
    else
        echo -e "  ${RED}✗${NC} Backend NOT running"
        echo "    Starting backend..."
        cd "$PROJECT_DIR/server" && npm run dev > /tmp/backend.log 2>&1 &
        sleep 5
    fi
    echo ""
}

# Run E2E tests
run_e2e_tests() {
    echo "🔬 Running E2E Tests..."
    echo ""

    python3 "$PROJECT_DIR/scripts/e2e-test.py" 2>&1

    echo ""
}

# Show manual test checklist
show_checklist() {
    echo "=============================================="
    echo "📋 Manual Test Checklist (48-Hour Features)"
    echo "=============================================="
    echo ""
    echo "Open: http://localhost:3000"
    echo "Invite Code: 2362369"
    echo ""
    echo "CHAT FEATURES:"
    echo "  [ ] Copy button on code blocks (hover over code)"
    echo "  [ ] Cmd+Enter sends message"
    echo "  [ ] Up arrow recalls previous message"
    echo "  [ ] Escape closes dropdowns"
    echo "  [ ] Loading skeletons on history load"
    echo "  [ ] Message hover actions (copy, retry)"
    echo "  [ ] Optimistic updates (instant send)"
    echo ""
    echo "OFFLINE MODE:"
    echo "  [ ] DevTools → Network → Offline"
    echo "  [ ] Amber 'offline' banner appears"
    echo "  [ ] Messages queue (shows count)"
    echo "  [ ] Queue processes on reconnect"
    echo ""
    echo "RICH RESPONSES:"
    echo "  [ ] Tables render as HTML (not markdown)"
    echo "  [ ] JSON responses are collapsible"
    echo "  [ ] Intent classifier shows predicted agent"
    echo ""
    echo "PERFORMANCE:"
    echo "  [ ] Smooth scroll with 50+ messages"
    echo "  [ ] No lag on rapid message sending"
    echo "  [ ] Code-split chunks load on demand"
    echo ""
}

# Main
main() {
    check_servers
    run_e2e_tests
    show_checklist

    echo "=============================================="
    echo "📸 Screenshots: $PROJECT_DIR/test-screenshots/"
    echo "=============================================="
}

main "$@"
