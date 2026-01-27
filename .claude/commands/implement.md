---
description: Execute implementation tasks from Linear ticket and task list
model: sonnet
---

## Linear Ticket

$ARGUMENTS

## Process

### 1. Load Context

- Fetch ticket: `mcp__plugin_linear_linear__get_issue` with ticket ID
- Search memory: `mcp__memory__search_nodes` for relevant patterns and decisions
- Navigate to worktree:
  ```bash
  cd "$HOME/code/feature_worktrees/[LINEAR_ID]"
  ```
- Read spec and tasks:
  ```bash
  cat specs-link/spec.md
  cat specs-link/tasks.md
  ```
- Note development mode (TDD or Non-TDD)

### 2. Execute Tasks In Order

For each task:

a. **Implement**: Write code following project conventions
   - **TDD Mode**: Write tests BEFORE implementation
   - **Non-TDD Mode**: Implementation only

b. **Validate**:
   ```bash
   # Type check
   pnpm typecheck  # or tsc --noEmit

   # TDD Mode only
   pnpm test -- --coverage
   ```

c. **Mark complete** in tasks.md

### 3. Phase Review

After completing a phase (group of related tasks):

Use Task tool with `subagent_type=pr-review-toolkit:code-reviewer`:
- Review against spec requirements and acceptance criteria
- Check functionality correctness
- Target: >= 9/10 score

**If score < 9/10** (max 3 iterations):
1. Analyze feedback
2. Fix issues
3. Re-run review
4. If still < 9 after 3 iterations, escalate to user

### 4. Commit

After review passes, present changes to user:
```bash
git diff
```

After user approval:
```bash
git add [related-files]
git commit -m "feat: [LINEAR_ID] [description]

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 5. Parallel Tasks

For tasks marked [P]:
- Use Task tool with `subagent_type=sonnet-agent` for parallel execution
- Only when tasks touch different files with no dependencies

### 6. Final Validation

```bash
# TDD mode: run all tests
pnpm test

# Build
pnpm build

# Clean state
git status
```

### 7. Store Learnings

Use `mcp__memory__add_observations` on the feature entity (`[LINEAR_ID]`):
- Implementation patterns discovered
- Problems solved and approaches used
- Reusable insights (not what was done, but what was learned)

### 8. Update Linear

Update ticket status to "In Review" with implementation summary.

### 9. Report

Output: tasks completed, commits created, test results (TDD), any blockers.

## Quality Standards

| Mode | Tests | Coverage | Review Score |
|------|-------|----------|--------------|
| TDD | Required first | >= 90% | >= 9/10 |
| Non-TDD | Not required | N/A | >= 9/10 |

## Next Step
Use `/complete-feature [LINEAR_ID]` to merge and cleanup.
