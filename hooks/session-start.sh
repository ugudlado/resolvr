#!/usr/bin/env bash
set -euo pipefail

PORT=37002
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

# Check if server is already running
if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
  exit 0
fi

# Start the Vite dev server in the background
cd "$PLUGIN_ROOT/.."
nohup pnpm dev >/dev/null 2>&1 &

# Wait for server to be ready (max 10s)
for i in $(seq 1 20); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
