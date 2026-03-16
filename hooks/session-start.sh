#!/usr/bin/env bash
set -euo pipefail

PORT=37003
SERVER_ALREADY_RUNNING=false

# Clean up old cached versions (non-blocking)
"${BASH_SOURCE%/*}/cleanup-cache.sh" >>/tmp/local-review-cleanup.log 2>&1 &

# Check if server is already running
if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
  SERVER_ALREADY_RUNNING=true
fi

if [ "$SERVER_ALREADY_RUNNING" = false ]; then
  # Prefer the live repo if it exists (for local development), otherwise find in cache
  LIVE_REPO="$HOME/code/review"
  if [ -f "$LIVE_REPO/apps/server/dist/index.js" ]; then
    PLUGIN_ROOT="$LIVE_REPO"
  else
    PLUGIN_ROOT=$(find ~/.claude/plugins/cache -name "index.js" -path "*/local-review/*/apps/server/dist/index.js" 2>/dev/null | head -1 | sed 's|/apps/server/dist/index.js||')
  fi

  if [ -z "$PLUGIN_ROOT" ]; then
    exit 0
  fi

  # Start the standalone server in the background (serves API + static UI dist/)
  cd "$PLUGIN_ROOT"
  nohup node apps/server/dist/index.js >/tmp/local-review-server.log 2>&1 &

  # Wait for server to be ready (max 10s)
  for i in $(seq 1 20); do
    if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Register current workspace (non-blocking)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -n "$REPO_ROOT" ]; then
  curl -s -X POST "http://localhost:$PORT/api/workspaces/register" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$REPO_ROOT\"}" >/dev/null 2>&1 || true
fi

# Cold-start the resolver daemon (non-blocking — fires and forgets)
curl -s -X POST "http://localhost:$PORT/api/resolver/cold-start" >/dev/null 2>&1 || true
