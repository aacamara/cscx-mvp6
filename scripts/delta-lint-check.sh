#!/usr/bin/env bash
# delta-lint-check.sh — Runs ESLint only on changed .ts/.tsx files.
#
# Usage: ./scripts/delta-lint-check.sh
#
# Environment:
#   CHANGED_FILES  — JSON array of changed file paths (from tj-actions/changed-files)
#                    Falls back to git diff against origin/main if unset.

set -euo pipefail

echo "=== Delta Lint Check ==="
echo ""

# --- Collect changed .ts/.tsx files ---
if [ -n "${CHANGED_FILES:-}" ]; then
  CHANGED_TS=$(echo "$CHANGED_FILES" | jq -r '.[]' 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
else
  CHANGED_TS=$(git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' 2>/dev/null || true)
fi

if [ -z "$CHANGED_TS" ]; then
  echo "No TypeScript files changed. Skipping lint check."
  exit 0
fi

FILE_COUNT=$(echo "$CHANGED_TS" | wc -l | tr -d ' ')
echo "Linting ${FILE_COUNT} changed file(s):"
echo "$CHANGED_TS" | sed 's/^/  /'
echo ""

# --- Separate server vs frontend files ---
SERVER_FILES=$(echo "$CHANGED_TS" | grep "^server/" || true)
FRONTEND_FILES=$(echo "$CHANGED_TS" | grep -v "^server/" || true)

EXIT_CODE=0

# --- Lint server files ---
if [ -n "$SERVER_FILES" ]; then
  echo "--- Server files ---"
  # Strip server/ prefix for eslint (runs from server/ dir)
  RELATIVE_SERVER=$(echo "$SERVER_FILES" | sed 's|^server/||')

  # Convert to space-separated for xargs
  cd server
  echo "$RELATIVE_SERVER" | xargs npx eslint --no-error-on-unmatched-pattern 2>&1 || EXIT_CODE=1
  cd ..
  echo ""
fi

# --- Lint frontend files ---
if [ -n "$FRONTEND_FILES" ]; then
  echo "--- Frontend files ---"
  echo "$FRONTEND_FILES" | xargs npx eslint --no-error-on-unmatched-pattern 2>&1 || EXIT_CODE=1
  echo ""
fi

# --- Report ---
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "No lint errors in changed files."
else
  echo "Lint errors found in changed files."
  echo ""
  echo "REMEDIATION: Fix the lint errors above. Run 'npm run lint' locally to verify."
fi

exit $EXIT_CODE
