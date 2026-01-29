---
description: Execute implementation tasks from Linear ticket and task list
model: sonnet
---

## Linear Ticket

$ARGUMENTS

## Plugins & Tools Used

| Step | Plugin/Tool | Purpose |
|------|-------------|---------|
| Context | `linear` plugin | Fetch ticket details |
| Context | `memory` MCP | Recall decisions from /specify |
| Implementation | `context7` plugin | Fetch latest library docs |
| Implementation | `typescript-lsp` plugin | Live type checking |
| Implementation | Project skills | Domain patterns (mobile/frontend/backend) |
| UI Components | `frontend-design` skill | Production-grade UI |
| Phase Review | `pr-review-toolkit:code-reviewer` | Code quality review |
| Final Review | `pr-review-toolkit` agents | Comprehensive review suite |
| Final Review | `code-simplifier` agent | Simplify complex code |

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
   - Use `context7` plugin (`mcp__plugin_context7_context7__query-docs`) for library documentation
   - Use project skills (mobile-engineer, frontend-engineer, backend-engineer) for domain patterns
   - Use `frontend-design` skill when building UI components

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

### 4. Commit Phase

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

Use `mcp__plugin_linear_linear__update_issue` to set status to "In Review" with implementation summary.

### 9. Final Comprehensive Review

Run full review suite before marking complete:

**a. Code Quality** - Task tool with `subagent_type=pr-review-toolkit:code-reviewer`
- Adherence to spec requirements
- Project conventions and patterns
- Code style and organization

**b. Silent Failures** - Task tool with `subagent_type=pr-review-toolkit:silent-failure-hunter`
- Error handling completeness
- Catch blocks that swallow errors
- Missing fallback behaviors

**c. Type Design** - Task tool with `subagent_type=pr-review-toolkit:type-design-analyzer`
- Type quality and encapsulation
- Invariant expression
- Type safety

**d. Test Coverage** (TDD mode) - Task tool with `subagent_type=pr-review-toolkit:pr-test-analyzer`
- Test completeness
- Edge cases covered
- Test quality

**e. Code Simplification** - Task tool with `subagent_type=code-simplifier:code-simplifier`
- Simplify overly complex code
- Remove unnecessary abstractions
- Improve readability

**Aggregate Score**: All reviews must pass (>= 9/10 where applicable)

### 10. Report

Output:
- Tasks completed with status
- Commits created
- Test results (TDD mode)
- Final review scores
- Any blockers or notes

## Quality Standards

| Mode | Tests | Coverage | Review Score |
|------|-------|----------|--------------|
| TDD | Required first | >= 90% | >= 9/10 |
| Non-TDD | Not required | N/A | >= 9/10 |

## Next Step
Use `/complete-feature [LINEAR_ID]` to merge and cleanup.
