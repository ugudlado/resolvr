#!/bin/bash
# Auto-start the local-review Vite dev server on session start.
# Runs in background so it doesn't block Claude startup.

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=3000

# Already running? Nothing to do.
if lsof -i ":$PORT" | grep -q LISTEN 2>/dev/null; then
  exit 0
fi

# Start Vite in background, log to .review/server.log
mkdir -p "$REPO_ROOT/.review"
nohup bash -c "cd '$REPO_ROOT' && pnpm dev" \
  > "$REPO_ROOT/.review/server.log" 2>&1 &

disown $!

# Wait for server to be ready, then open browser
(
  for i in $(seq 1 10); do
    sleep 1
    if lsof -i ":$PORT" | grep -q LISTEN 2>/dev/null; then
      open "http://localhost:$PORT"
      break
    fi
  done
) &
