---
description: Execute implementation tasks from feature spec and task list
argument-hint: "[FEATURE-ID] — feature to implement (partial match supported)"
model: sonnet
---

## Feature ID

$ARGUMENTS

## Plugins & Skills Composed

| Step           | Plugin/Skill                              | Purpose                                       |
| -------------- | ----------------------------------------- | --------------------------------------------- |
| Context        | `linear` plugin                           | Fetch ticket details                          |
| Context        | `claude-mem` plugin                       | Recall decisions from /specify                |
| Execution      | `superpowers:subagent-driven-development` | Fresh subagent per task with two-stage review |
| TDD            | `superpowers:test-driven-development`     | Red-green-refactor cycle (TDD mode)           |
| Debugging      | `superpowers:systematic-debugging`        | Root-cause analysis on failures               |
| Implementation | `context7` plugin                         | Fetch latest library docs                     |
| Implementation | Project skills                            | Domain patterns (mobile/frontend/backend)     |
| UI Components  | `frontend-design` skill                   | Production-grade UI                           |
| Simplification | `/simplify` skill                         | Clean up code before final review             |
| Final Review   | `pr-review-toolkit` agents                | Comprehensive review suite                    |

## Process

### 1. Load Context

- **Find worktree**: The feature ID may be a partial match (e.g., `HL-80` for `HL-80-add-auth-flow`). Use glob matching to find the worktree:
  ```bash
  WORKTREE=$(ls -d "$HOME/code/feature_worktrees/${FEATURE_ID}"* 2>/dev/null | head -1)
  if [ -z "$WORKTREE" ]; then echo "ERROR: No worktree found for $FEATURE_ID"; exit 1; fi
  cd "$WORKTREE"
  ```
- Fetch ticket (if Linear ID present): `mcp__plugin_linear_linear__get_issue` with ticket ID
- Search memory: `mcp__plugin_claude-mem_mcp-search__search` for relevant patterns and decisions
- Read spec and tasks:
  ```bash
  FEATURE_DIR=$(ls -d specs/active/${FEATURE_ID}* 2>/dev/null | head -1)
  cat "$FEATURE_DIR/spec.md"
  cat "$FEATURE_DIR/tasks.md"
  ```
- Note development mode (TDD or Non-TDD)

### 1b. Check for Resume State

Before starting fresh, check if this is a resumed session:

- Run `git status` to check for uncommitted changes from a previous run
- Check tasks.md for any `[→]` (in-progress) tasks
- If uncommitted changes exist, present them to the user before proceeding
- If a task is marked `[→]`, resume from that task instead of starting over

### 2. Understand Task Graph

Read tasks.md and identify:

- Which tasks are pending `[ ]` (skip `[x]` done and `[~]` skipped)
- Dependencies via `(depends: Txxx)` — a task is **ready** when all its dependencies are `[x]`
- Groups of `[P]` tasks that can run in parallel
- Extract ALL tasks with full text upfront (subagents should not read plan files)

### 2b. Task-First Gate

**All work MUST be tracked in tasks.md before implementation begins.**

If the user requests work that doesn't have a corresponding task:

1. **Stop** — do not start coding
2. **Add a new phase** (or append to the current phase) in tasks.md with properly numbered tasks
3. **Each task MUST include**: Why, Files, Done when
4. **Then proceed** with implementation

### 3. Execute Tasks via Subagent-Driven Development

**Invoke `superpowers:subagent-driven-development` skill.** This is the core execution model.

For each task, the controller (this session) orchestrates 3 subagents:

#### 3a. Implementer Subagent

Dispatch a `sonnet-agent` with:

- Full task text (don't make subagent read files)
- Scene-setting context: where this task fits in the feature, dependencies, architectural context from spec
- Development mode instructions:
  - **TDD mode**: Subagent must follow `superpowers:test-driven-development` — write failing test first, then implement
  - **Non-TDD mode**: Implement directly, validate with type check
- Project skill context (frontend-engineer, backend-engineer, etc.) based on task domain
- `frontend-design` skill if task involves UI components
- `context7` plugin for library documentation

Subagent implements, tests, self-reviews, and commits.

**If subagent asks questions**: Answer clearly before letting them proceed.
**If subagent encounters failures**: Subagent should use `superpowers:systematic-debugging` — root cause first, no guess-fixes.

#### 3b. Spec Compliance Reviewer

After implementer completes, dispatch a `sonnet-agent` as spec reviewer:

- Provide the task requirements AND the implementer's report
- Reviewer MUST read actual code (not trust the report)
- Checks: missing requirements, extra unneeded work, misunderstandings
- Result: ✅ spec compliant OR ❌ issues with file:line references

**If issues found**: Implementer subagent fixes → reviewer re-reviews → repeat until ✅

#### 3c. Code Quality Reviewer

**Only after spec compliance passes.** Dispatch `pr-review-toolkit:code-reviewer`:

- Review the task's commits (BASE_SHA to HEAD_SHA)
- Checks: code quality, testing, maintainability, project conventions
- Result: approved OR issues to fix

**If issues found**: Implementer fixes → reviewer re-reviews → repeat until approved.

#### 3d. Mark Complete

After both reviews pass: mark task `[x]` in tasks.md.

#### For `[P]` (parallel) task groups:

**Only dispatch parallel implementers if the `[P]` tasks touch completely different files.** Check the "Files" field in each task. If any share files, run them sequentially.

For safe parallel tasks: dispatch multiple implementer subagents simultaneously, each in isolated worktrees (`isolation: "worktree"`). Run spec + quality reviews after all complete.

### 4. Phase Review

After completing all tasks in a phase:

**Verify before claiming phase is done:**

- Run type check: `pnpm type-check` (or `npx tsc --noEmit`)
- Run tests: `pnpm test:unit` (TDD mode: with `--coverage`)
- Run build: `pnpm build`
- Read output, confirm exit codes, count failures
- Only THEN claim phase completion

**If verification fails**: Use `superpowers:systematic-debugging` skill — do NOT guess-fix.

### 5. Commit Phase

After phase review passes, present changes to user:

```bash
git diff
```

After user approval:

```bash
git add [related-files]
git commit -m "feat: [FEATURE_ID] [description]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Continue to next phase automatically.** Do not wait for user input between phases unless there are open questions.

### 6. Final Validation

- All tasks in tasks.md should be `[x]` or `[~]`
- No `[ ]` or `[→]` remaining

```bash
pnpm test:unit
pnpm build
git status
```

Read full output. Confirm all pass. THEN proceed.

### 7. Simplify Code

Invoke the `/simplify` skill on changed files. If simplification makes changes, re-run verification (step 6).

### 8. Final Comprehensive Review

Dispatch final code reviewer subagent for the entire implementation (not per-task).

Then run review suite in parallel (these are independent):

**a. Code Quality** - Agent tool with `subagent_type=pr-review-toolkit:code-reviewer`
**b. Silent Failures** - Agent tool with `subagent_type=pr-review-toolkit:silent-failure-hunter`
**c. Type Design** - Agent tool with `subagent_type=pr-review-toolkit:type-design-analyzer`
**d. Test Coverage** (TDD mode) - Agent tool with `subagent_type=pr-review-toolkit:pr-test-analyzer`

Launch all applicable reviews in parallel. Aggregate results.

**If any critical issues found:** Fix, re-run `/simplify` if needed, and re-verify.

### 9. Store Learnings

Use `mcp__plugin_claude-mem_mcp-search__save_observation` with project `[FEATURE_ID]`:

- Implementation patterns discovered
- Problems solved and approaches used
- Reusable insights

### 10. Update Linear (if applicable)

If a Linear ticket exists, use `mcp__plugin_linear_linear__update_issue` to set status to "In Review" with implementation summary.

### 11. Report

Output:

- Task summary from tasks.md (count of done/skipped/total)
- Commits created
- Test results (TDD mode)
- Final review scores
- Any blockers or notes

## Autonomy Guidelines

**Run without asking unless:**

- A task has `[NEEDS CLARIFICATION]` in the spec
- Review score < 9/10 after 3 iterations
- Merge conflict that can't be auto-resolved
- Test failure that `superpowers:systematic-debugging` skill can't resolve after 2 attempts
- Subagent asks a question that needs user domain knowledge

**Never start untracked work:**

- Every code change must map to a task in tasks.md
- If work doesn't have a task, create one first

**Always pause for user approval on:**

- Commits (show diff first)
- Skipping a task (mark `[~]` with reason)

**Subagent rules:**

- Never dispatch multiple implementer subagents on overlapping files
- Never skip spec compliance review
- Never start code quality review before spec compliance passes
- Never move to next task while either review has open issues
- If subagent fails, dispatch fix subagent — don't fix manually (context pollution)

## Quality Standards

| Mode    | Tests          | Coverage | Review Score |
| ------- | -------------- | -------- | ------------ |
| TDD     | Required first | >= 90%   | >= 9/10      |
| Non-TDD | Not required   | N/A      | >= 9/10      |

## Next Step

Use `/complete-feature [FEATURE_ID]` to merge and cleanup.
