#!/bin/bash
# PostToolUse (Write|Edit): Run tsc --noEmit on TypeScript file changes
set -euo pipefail
INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only check TypeScript files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Find the nearest tsconfig.json by walking up from the file
DIR=$(dirname "$FILE_PATH")
TSCONFIG=""
while [[ "$DIR" != "/" ]]; do
  if [[ -f "$DIR/tsconfig.json" ]]; then
    TSCONFIG="$DIR/tsconfig.json"
    break
  fi
  DIR=$(dirname "$DIR")
done

[[ -z "$TSCONFIG" ]] && exit 0

TSC_DIR=$(dirname "$TSCONFIG")
TSC_OUTPUT=$(cd "$TSC_DIR" && npx tsc --noEmit --pretty false 2>&1 | head -20) || true

if [[ -n "$TSC_OUTPUT" ]]; then
  ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")
  if [[ "$ERROR_COUNT" -gt 0 ]]; then
    echo "TypeScript: $ERROR_COUNT type error(s) found" >&2
    echo "$TSC_OUTPUT" | head -10 >&2
  fi
fi

exit 0
