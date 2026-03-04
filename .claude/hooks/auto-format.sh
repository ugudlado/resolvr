#!/bin/bash
# PostToolUse (Write|Edit): Run Prettier on changed files
set -euo pipefail
INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only format supported file types
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md) ;;
  *) exit 0 ;;
esac

# Find project root with prettier config
DIR=$(dirname "$FILE_PATH")
PROJECT_ROOT=""
while [[ "$DIR" != "/" ]]; do
  if [[ -f "$DIR/.prettierrc" ]] || [[ -f "$DIR/prettier.config.js" ]] || [[ -f "$DIR/.prettierrc.json" ]]; then
    PROJECT_ROOT="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

[[ -z "$PROJECT_ROOT" ]] && exit 0

cd "$PROJECT_ROOT"
npx prettier --write "$FILE_PATH" 2>/dev/null || true

exit 0
