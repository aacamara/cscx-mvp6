#!/bin/bash
# Run the Streaming Chat Ralph loop
# Usage: ./run-streaming.sh [max_iterations]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS="${1:-15}"

echo "Setting up Streaming Chat loop..."

# Copy the streaming PRD and progress files
cp "$SCRIPT_DIR/prd-streaming.json" "$SCRIPT_DIR/prd.json"
cp "$SCRIPT_DIR/progress-streaming.txt" "$SCRIPT_DIR/progress.txt"

echo "PRD: prd-streaming.json -> prd.json"
echo "Progress: progress-streaming.txt -> progress.txt"
echo ""

# Run the loop
"$SCRIPT_DIR/ralph.sh" --tool claude "$MAX_ITERATIONS"

# Copy progress back to the specific file
cp "$SCRIPT_DIR/progress.txt" "$SCRIPT_DIR/progress-streaming.txt"
echo "Progress saved to progress-streaming.txt"
