---
description: Complete feature development with merge to main and cleanup of worktrees
model: haiku
---

## Linear Ticket

$ARGUMENTS

## Process

### 1. Verify Completion

```bash
cd "$HOME/code/feature_worktrees/[LINEAR_ID]"
cat specs-link/tasks.md | grep -c "\[ \]"  # Should be 0
git status
git log --oneline -5
```

### 2. Final Validation

```bash
pnpm test    # If TDD mode
pnpm build
```

### 3. Sync With Main

```bash
git fetch origin
git merge origin/main
# Resolve conflicts if any, then re-test
```

### 4. Present For Approval

Show:
- `git diff origin/main --stat`
- Test results
- Confirm ready to merge

**WAIT for user approval before proceeding.**

### 5. Push and Merge

```bash
# Push feature branch
git push -u origin feature/[LINEAR_ID]

# Merge to main
MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')
cd "$MAIN_REPO"
git checkout main
git pull origin main
git merge feature/[LINEAR_ID] --no-ff -m "feat: [LINEAR_ID] [Feature description]

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 6. Cleanup

Show what will be removed, then **WAIT for user approval**.

```bash
cd "$MAIN_REPO"
git worktree remove "$HOME/code/feature_worktrees/[LINEAR_ID]"
git worktree prune
git branch -d feature/[LINEAR_ID]
git push origin --delete feature/[LINEAR_ID]
```

### 7. Close Out

- Update Linear ticket to "Done": `mcp__plugin_linear_linear__update_issue`
- Store final learnings in memory MCP: `mcp__memory__add_observations`

### 8. Report

```
Feature Complete: [LINEAR_ID]
- Merged to main
- Worktree removed
- Branches deleted
- Linear ticket closed
- Merge commit: [SHA]
```

## Error Recovery

### Merge Conflicts
```bash
git status
# Resolve conflicts
git add .
git commit -m "fix: resolve merge conflicts"
```

### Rollback If Needed
```bash
git checkout main
git revert -m 1 [merge-commit-sha]
git push origin main
```
