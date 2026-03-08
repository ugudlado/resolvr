#!/usr/bin/env bash
# run.sh — Resolve all open review threads headlessly via claude -p
#
# Usage:
#   bash scripts/resolve-async/run.sh <session-file>
#   bash scripts/resolve-async/run.sh --code <feature-id>
#   bash scripts/resolve-async/run.sh --spec <feature-id>
#   bash scripts/resolve-async/run.sh   (most recent session)
#   bash scripts/resolve-async/run.sh --dry-run [...]  (preview threads, skip claude -p)
#
# Note: Run from a regular terminal, NOT from inside a Claude Code session.
# Claude Code sets $CLAUDECODE which blocks nested claude -p invocations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SESSIONS_DIR="$REPO_ROOT/.review/sessions"
CONTEXT_SCRIPT="$REPO_ROOT/scripts/review-context.sh"

# --- Timing helpers (macOS date lacks %N, use python3 fallback) ---
millis() { python3 -c 'import time; print(int(time.time()*1000))'; }
START_MS=$(millis)

log() {
  local now_ms elapsed secs ms
  now_ms=$(millis)
  elapsed=$(( now_ms - START_MS ))
  secs=$(( elapsed / 1000 ))
  ms=$(( elapsed % 1000 ))
  printf "[%d.%03ds] %s\n" "$secs" "$ms" "$1" >&2
}

# --- Notify UI of resolve progress ---
notify_ui() {
  local event="$1"
  local data="$2"
  curl -s -X POST "$API_BASE/resolve-progress" \
    -H 'Content-Type: application/json' \
    -d "{\"event\":\"$event\",\"data\":$data}" \
    >/dev/null 2>&1 || true
}

# --- Find session file ---
find_session() {
  local mode="" feature_id="" session_file=""

  case "${1:-}" in
    --code)
      mode="code"
      feature_id="${2:-}"
      ;;
    --spec)
      mode="spec"
      feature_id="${2:-}"
      ;;
    "")
      # No args — most recent session
      session_file=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
      ;;
    *)
      # Direct session file path
      if [[ -f "$1" ]]; then
        session_file="$1"
      elif [[ -f "$SESSIONS_DIR/$1" ]]; then
        session_file="$SESSIONS_DIR/$1"
      else
        echo "Session file not found: $1" >&2
        exit 1
      fi
      ;;
  esac

  if [[ -n "$mode" && -n "$feature_id" ]]; then
    session_file=$(ls -t "$SESSIONS_DIR"/*"$feature_id"*-"$mode".json 2>/dev/null | head -1)
  elif [[ -n "$mode" ]]; then
    session_file=$(ls -t "$SESSIONS_DIR"/*-"$mode".json 2>/dev/null | head -1)
  fi

  if [[ -z "$session_file" || ! -f "$session_file" ]]; then
    echo "No matching session found. Save a review session from the UI first." >&2
    exit 1
  fi

  echo "$session_file"
}

# --- Strip --dry-run flag before session lookup ---
DRY_RUN=false
FILTERED_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  else
    FILTERED_ARGS+=("$arg")
  fi
done

SESSION_FILE=$(find_session "${FILTERED_ARGS[@]+"${FILTERED_ARGS[@]}"}")
log "Session: $SESSION_FILE"

# --- Detect session type ---
SESSION_TYPE="code"
if jq -e '.specPath // .specFile' "$SESSION_FILE" >/dev/null 2>&1; then
  SESSION_TYPE="spec"
fi

FEATURE_ID=$(jq -r '.featureId' "$SESSION_FILE")
log "Feature: $FEATURE_ID (type: $SESSION_TYPE)"

# --- Detect API port from vite.config.ts ---
API_PORT=$(grep -oE 'port: [0-9]+' "$REPO_ROOT/apps/ui/vite.config.ts" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "37003")
API_BASE="http://localhost:$API_PORT/api"
log "API: $API_BASE"

# --- Find open threads ---
THREAD_IDS=$(jq -r '.threads[] | select(.status == "open") | .id' "$SESSION_FILE")
THREAD_COUNT=$(echo "$THREAD_IDS" | grep -c . || true)

if [[ "$THREAD_COUNT" -eq 0 ]]; then
  log "No open threads to resolve."
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  log "Dry run — $THREAD_COUNT open thread(s) would be processed:"
  for tid in $THREAD_IDS; do
    anchor=$(jq -r --arg id "$tid" '.threads[] | select(.id == $id) | "\(.filePath):\(.line)"' "$SESSION_FILE")
    printf "  %s  %s\n" "$tid" "$anchor" >&2
  done
  exit 0
fi

# Build thread list for UI progress tracking
THREAD_LIST="["
FIRST_TL=true
for tid in $THREAD_IDS; do
  TL_INFO=$(jq -r --arg id "$tid" '.threads[] | select(.id == $id) | "{\"id\":\"\(.id)\",\"filePath\":\"\(.filePath // "")\",\"line\":\(.line // 0)}"' "$SESSION_FILE")
  if $FIRST_TL; then
    FIRST_TL=false
  else
    THREAD_LIST+=","
  fi
  THREAD_LIST+="$TL_INFO"
done
THREAD_LIST+="]"

notify_ui "review:resolve-started" "{\"featureId\":\"$FEATURE_ID\",\"threadCount\":$THREAD_COUNT,\"threads\":$THREAD_LIST}"

log "Extracting $THREAD_COUNT thread contexts..."

# --- Phase 1: Extract all contexts ---
CONTEXTS="["
FIRST=true
for tid in $THREAD_IDS; do
  CTX=$("$CONTEXT_SCRIPT" "$SESSION_FILE" "$tid" 2>/dev/null) || {
    log "WARNING: Failed to extract context for thread $tid, skipping"
    continue
  }
  if $FIRST; then
    FIRST=false
  else
    CONTEXTS+=","
  fi
  CONTEXTS+="$CTX"
done
CONTEXTS+="]"

log "Contexts ready ($THREAD_COUNT threads)."

# --- Build prompt ---
PROMPT=$(cat <<EOF
{
  "sessionFile": "$SESSION_FILE",
  "sessionType": "$SESSION_TYPE",
  "featureId": "$FEATURE_ID",
  "apiBase": "$API_BASE",
  "threads": $CONTEXTS
}
EOF
)

# --- Phase 2: Invoke claude -p ---
log "Invoking claude -p..."

SYSTEM_PROMPT="$SCRIPT_DIR/system-prompt.md"

EXIT_CODE=0
claude -p \
  --system-prompt "$(cat "$SYSTEM_PROMPT")" \
  --allowed-tools "Read Edit Bash" \
  --model sonnet \
  "$PROMPT" || EXIT_CODE=$?

# --- Phase 3: Summary ---
if [[ $EXIT_CODE -eq 0 ]]; then
  RESOLVED=$(jq '[.threads[] | select(.status == "resolved")] | length' "$SESSION_FILE")
  STILL_OPEN=$(jq '[.threads[] | select(.status == "open")] | length' "$SESSION_FILE")
  log "Done. Resolved: $RESOLVED, Still open: $STILL_OPEN"
  notify_ui "review:resolve-completed" "{\"featureId\":\"$FEATURE_ID\",\"resolved\":$RESOLVED,\"clarifications\":$STILL_OPEN}"
else
  log "claude -p exited with code $EXIT_CODE"
  notify_ui "review:resolve-failed" "{\"featureId\":\"$FEATURE_ID\",\"error\":\"claude -p exited with code $EXIT_CODE\"}"
fi

exit $EXIT_CODE
