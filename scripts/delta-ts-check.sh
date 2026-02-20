#!/usr/bin/env bash
# delta-ts-check.sh — Fails only if changed files introduce NEW TypeScript errors.
#
# Usage: ./scripts/delta-ts-check.sh <project-dir> <tsconfig-path>
#   e.g. ./scripts/delta-ts-check.sh server server/tsconfig.json
#   e.g. ./scripts/delta-ts-check.sh . tsconfig.json
#
# Environment:
#   CHANGED_FILES  — JSON array of changed file paths (from tj-actions/changed-files)
#                    Falls back to git diff against origin/main if unset.

set -euo pipefail

PROJECT_DIR="${1:-.}"
TSCONFIG="${2:-tsconfig.json}"

echo "=== Delta TypeScript Check ==="
echo "Project: ${PROJECT_DIR}"
echo "TSConfig: ${TSCONFIG}"
echo ""

# --- Collect changed .ts/.tsx files ---
if [ -n "${CHANGED_FILES:-}" ]; then
  CHANGED_TS=$(echo "$CHANGED_FILES" | jq -r '.[]' 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
else
  CHANGED_TS=$(git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' 2>/dev/null || true)
fi

# If project dir is not root, filter to only files within that directory
if [ "$PROJECT_DIR" != "." ]; then
  CHANGED_TS=$(echo "$CHANGED_TS" | grep "^${PROJECT_DIR}/" || true)
fi

if [ -z "$CHANGED_TS" ]; then
  echo "No TypeScript files changed in ${PROJECT_DIR}. Skipping."
  exit 0
fi

FILE_COUNT=$(echo "$CHANGED_TS" | wc -l | tr -d ' ')
echo "Changed TS files (${FILE_COUNT}):"
echo "$CHANGED_TS" | sed 's/^/  /'
echo ""

# --- Run tsc and capture all errors ---
# tsc will exit non-zero if there are errors — that's expected with legacy debt
TSC_OUTPUT=$(npx tsc --noEmit --pretty false --project "$TSCONFIG" 2>&1 || true)

# --- Filter errors to only changed files ---
ERRORS_FOUND=""
TOTAL_NEW=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Strip project dir prefix for matching against tsc output
  if [ "$PROJECT_DIR" != "." ]; then
    # tsc outputs paths relative to tsconfig location
    relative_file=$(echo "$file" | sed "s|^${PROJECT_DIR}/||")
  else
    relative_file="$file"
  fi

  # Match errors: filename(line,col): error TSxxxx: message
  file_errors=$(echo "$TSC_OUTPUT" | grep -F "${relative_file}(" | grep "error TS" || true)

  if [ -n "$file_errors" ]; then
    count=$(echo "$file_errors" | wc -l | tr -d ' ')
    TOTAL_NEW=$((TOTAL_NEW + count))
    ERRORS_FOUND="${ERRORS_FOUND}
--- ${file} (${count} error(s)) ---
${file_errors}
"
  fi
done <<< "$CHANGED_TS"

# --- Report ---
if [ "$TOTAL_NEW" -eq 0 ]; then
  echo "No new TypeScript errors in changed files."
  exit 0
else
  echo "TypeScript errors found in changed files:"
  echo ""
  echo "$ERRORS_FOUND"
  echo ""
  echo "Total new errors: ${TOTAL_NEW}"
  echo ""
  echo "REMEDIATION: Fix the type errors above. Do NOT use @ts-ignore or @ts-expect-error."
  exit 1
fi
