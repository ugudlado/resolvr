#!/bin/bash
# PreCompact: Re-inject session context before compaction so it survives compression
set -euo pipefail

CONTEXT=""

# Current branch and recent commits
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "none")

CONTEXT+="## Current State\n"
CONTEXT+="Branch: $BRANCH\n"
CONTEXT+="Recent commits:\n$RECENT_COMMITS\n\n"

# If we're in a feature worktree, load spec and tasks
if [[ "$(pwd)" == */code/feature_worktrees/* ]]; then
  WORKTREE_ROOT=$(echo "$(pwd)" | sed 's|\(.*code/feature_worktrees/[^/]*\).*|\1|')
  FEATURE_ID=$(basename "$WORKTREE_ROOT")

  CONTEXT+="## Feature: $FEATURE_ID\n"

  # Try slug-based spec directory first, then flat
  SPEC_DIR=$(find "$WORKTREE_ROOT/specs/active" -maxdepth 1 -type d -name "${FEATURE_ID}*" 2>/dev/null | head -1)
  if [[ -z "$SPEC_DIR" ]]; then
    SPEC_DIR="$WORKTREE_ROOT/specs/active"
  fi

  SPEC_FILE="$SPEC_DIR/spec.md"
  TASKS_FILE="$SPEC_DIR/tasks.md"

  if [[ -f "$SPEC_FILE" ]]; then
    SPEC_HEAD=$(head -50 "$SPEC_FILE")
    CONTEXT+="### Spec Summary\n$SPEC_HEAD\n\n"
  fi

  if [[ -f "$TASKS_FILE" ]]; then
    TASKS_CONTENT=$(cat "$TASKS_FILE")
    CONTEXT+="### Task Status\n$TASKS_CONTENT\n\n"
  fi
fi

# Uncommitted changes
GIT_STATUS=$(git status --short 2>/dev/null | head -20)
if [[ -n "$GIT_STATUS" ]]; then
  CONTEXT+="## Uncommitted Changes\n$GIT_STATUS\n"
fi

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PreCompact",
    additionalContext: $ctx
  }
}'
