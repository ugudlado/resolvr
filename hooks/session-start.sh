#!/usr/bin/env bash
set -euo pipefail

PORT=37003
SERVER_ALREADY_RUNNING=false

# Check if server is already running
if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
  SERVER_ALREADY_RUNNING=true
fi

if [ "$SERVER_ALREADY_RUNNING" = false ]; then
  # Prefer the live repo if it exists (for local development), otherwise find in cache
  LIVE_REPO="$HOME/code/review"
  if [ -f "$LIVE_REPO/apps/server/src/index.ts" ] && [ -d "$LIVE_REPO/apps/server/node_modules" ]; then
    PLUGIN_ROOT="$LIVE_REPO"
  else
    PLUGIN_ROOT=$(find ~/.claude/plugins/cache -name "index.ts" -path "*/local-review/*/apps/server/src/index.ts" 2>/dev/null | head -1 | sed 's|/apps/server/src/index.ts||')
  fi

  if [ -z "$PLUGIN_ROOT" ]; then
    exit 0
  fi

  # Start the standalone server in the background (serves API + static UI dist/)
  cd "$PLUGIN_ROOT"
  nohup pnpm -C apps/server dev >/tmp/local-review-server.log 2>&1 &

  # Wait for server to be ready (max 10s)
  for i in $(seq 1 20); do
    if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Cold-start the resolver daemon (non-blocking — fires and forgets)
curl -s -X POST "http://localhost:$PORT/api/resolver/cold-start" >/dev/null 2>&1 || true
