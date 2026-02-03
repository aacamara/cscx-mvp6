#!/bin/bash
# Run the Security Hardening Ralph loop
# Usage: ./run-security.sh [max_iterations]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS="${1:-15}"

echo "Setting up Security Hardening loop..."

# Copy the security PRD and progress files
cp "$SCRIPT_DIR/prd-security.json" "$SCRIPT_DIR/prd.json"
cp "$SCRIPT_DIR/progress-security.txt" "$SCRIPT_DIR/progress.txt"

echo "PRD: prd-security.json -> prd.json"
echo "Progress: progress-security.txt -> progress.txt"
echo ""

# Run the loop
"$SCRIPT_DIR/ralph.sh" --tool claude "$MAX_ITERATIONS"

# Copy progress back to the specific file
cp "$SCRIPT_DIR/progress.txt" "$SCRIPT_DIR/progress-security.txt"
echo "Progress saved to progress-security.txt"
