#!/usr/bin/env bash
# Start the local-review server in the background if it's not already running.
# Ensures the latest version is always running — kills older versions.
set -euo pipefail

PORT=37003
SERVER_ALREADY_RUNNING=false

# Clean up old cached versions (blocking — may kill server running from old version)
cleanup_result=$("${BASH_SOURCE%/*}/cleanup-cache.sh" 2>>/tmp/local-review-cleanup.log) || true

# Determine where to run from: live repo (dev) or latest cached version (by mtime)
LIVE_REPO="$HOME/code/review"
CACHE_DIR="$HOME/.claude/plugins/cache/ugudlado/local-review"
PLUGIN_ROOT=""

if [ -f "$LIVE_REPO/apps/server/dist/index.js" ]; then
  PLUGIN_ROOT="$LIVE_REPO"
else
  latest_dir=$(ls -dt "$CACHE_DIR"/*/ 2>/dev/null | head -1)
  if [ -n "$latest_dir" ] && [ -f "$latest_dir/apps/server/dist/index.js" ]; then
    PLUGIN_ROOT="$latest_dir"
  fi
fi

if [ -z "$PLUGIN_ROOT" ]; then
  exit 0
fi

# Read the version we expect to be running
expected_version=$(python3 -c "import json; print(json.load(open('$PLUGIN_ROOT/.claude-plugin/plugin.json')).get('version',''))" 2>/dev/null || true)

# Check if server is already running AND is the right version (unless cleanup just killed it)
if [ "$cleanup_result" != "SERVER_KILLED" ] && lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
  running_version=$(curl -s --max-time 2 "http://localhost:$PORT/api/health" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || true)

  if [ -n "$expected_version" ] && [ "$running_version" = "$expected_version" ]; then
    SERVER_ALREADY_RUNNING=true
  else
    # Wrong version or unresponsive — kill it
    STALE_PID=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$STALE_PID" ]; then
      kill "$STALE_PID" 2>/dev/null || true
      sleep 1
    fi
  fi
fi

if [ "$SERVER_ALREADY_RUNNING" = false ]; then
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
# Resolve worktree paths to the main repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/.git" ]; then
  # .git is a file → this is a worktree, resolve to main repo
  REPO_ROOT=$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null | sed 's|/\.git$||')
fi
if [ -n "$REPO_ROOT" ]; then
  curl -s -X POST "http://localhost:$PORT/api/workspaces/register" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$REPO_ROOT\"}" >/dev/null 2>&1 || true
fi

# Cold-start the resolver daemon (non-blocking — fires and forgets)
curl -s -X POST "http://localhost:$PORT/api/resolver/cold-start" >/dev/null 2>&1 || true
