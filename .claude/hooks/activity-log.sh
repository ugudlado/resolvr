#!/bin/bash
# PostToolUse (async): Log tool activity for tail -f monitoring
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id' | tail -c 9)
TIMESTAMP=$(date +"%H:%M:%S")

case "$TOOL_NAME" in
  Write|Edit)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"')
    ;;
  Bash)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.command // "unknown"' | head -c 80)
    ;;
  Read|Glob|Grep)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.pattern // .tool_input.path // "unknown"' | head -c 80)
    ;;
  Agent)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.description // "unknown"')
    ;;
  *)
    DETAIL="$TOOL_NAME"
    ;;
esac

LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"
printf "%s | %s | %-6s | %s\n" "$TIMESTAMP" "$SESSION_ID" "$TOOL_NAME" "$DETAIL" >> "$LOG_DIR/activity.log"

exit 0
