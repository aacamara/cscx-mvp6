#!/usr/bin/env bash
# lint-org-filter.sh — Custom linter: verifies route files use auth + org filtering.
#
# Checks that every route file in server/src/routes/ imports from middleware/auth
# or middleware/orgFilter. Error messages include agent-readable remediation instructions.
#
# Usage: ./scripts/lint-org-filter.sh [--changed-only]
#
# Environment:
#   CHANGED_FILES  — JSON array of changed file paths (optional, used with --changed-only)

set -euo pipefail

CHANGED_ONLY=false
if [ "${1:-}" = "--changed-only" ]; then
  CHANGED_ONLY=true
fi

ROUTES_DIR="server/src/routes"
echo "=== Org Filter Lint ==="
echo ""

# --- Determine which route files to check ---
if [ "$CHANGED_ONLY" = true ]; then
  if [ -n "${CHANGED_FILES:-}" ]; then
    ROUTE_FILES=$(echo "$CHANGED_FILES" | jq -r '.[]' 2>/dev/null | grep "^${ROUTES_DIR}/[^_].*\.ts$" | grep -v "__tests__" || true)
  else
    ROUTE_FILES=$(git diff --name-only origin/main...HEAD -- "${ROUTES_DIR}/*.ts" 2>/dev/null | grep -v "__tests__" || true)
  fi
else
  ROUTE_FILES=$(find "$ROUTES_DIR" -maxdepth 1 -name "*.ts" -not -name "index.ts" 2>/dev/null | sort || true)
fi

if [ -z "$ROUTE_FILES" ]; then
  echo "No route files to check. Skipping."
  exit 0
fi

FILE_COUNT=$(echo "$ROUTE_FILES" | wc -l | tr -d ' ')
echo "Checking ${FILE_COUNT} route file(s)..."
echo ""

ERRORS=0
WARNINGS=""

while IFS= read -r file; do
  [ -z "$file" ] && continue
  [ ! -f "$file" ] && continue

  basename=$(basename "$file")

  # Skip index files and test directories
  if [ "$basename" = "index.ts" ]; then
    continue
  fi

  # Check for auth middleware import
  HAS_AUTH=$(grep -l "middleware/auth\|requireAuth\|optionalAuth\|authenticateUser" "$file" 2>/dev/null || true)

  # Check for org filter import
  HAS_ORG=$(grep -l "middleware/orgFilter\|applyOrgFilter\|withOrgId\|filterInMemoryByOrg" "$file" 2>/dev/null || true)

  if [ -z "$HAS_AUTH" ]; then
    ERRORS=$((ERRORS + 1))
    WARNINGS="${WARNINGS}
ERROR: ${file}
  Missing auth middleware import.
  REMEDIATION: Add one of these imports:
    import { requireAuth } from '../middleware/auth';
    import { optionalAuth } from '../middleware/auth';
  Then apply as Express middleware: router.use(requireAuth);
"
  fi

  if [ -z "$HAS_ORG" ]; then
    # This is a warning, not an error — some routes may legitimately not need org filtering
    # (e.g., health check, public endpoints)
    WARNINGS="${WARNINGS}
WARNING: ${file}
  No org filter helpers detected. If this route accesses tenant data,
  it MUST use org filtering.
  REMEDIATION: Add: import { applyOrgFilter, withOrgId } from '../middleware/orgFilter';
  Then use: const { data } = await supabase.from('table').select('*').match(applyOrgFilter(req));
"
  fi

done <<< "$ROUTE_FILES"

# --- Report ---
if [ -n "$WARNINGS" ]; then
  echo "$WARNINGS"
  echo ""
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "Found ${ERRORS} route file(s) missing auth middleware."
  echo ""
  echo "See docs/architecture/multi-tenancy.md for org filtering requirements."
  exit 1
else
  echo "All checked route files have auth middleware."
  exit 0
fi
