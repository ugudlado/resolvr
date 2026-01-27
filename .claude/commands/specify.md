---
description: Create Linear ticket and feature specification from natural language description
model: opus
---

## Feature Description

$ARGUMENTS

## Process

### 1. Gather Context

- Search memory MCP (`mcp__memory__search_nodes`) for relevant patterns and past decisions
- Use Task tool with `subagent_type=Explore` to understand the relevant codebase area
- Identify existing patterns, conventions, and integration points

### 2. Create Linear Ticket

Use `mcp__plugin_linear_linear__create_issue`:
- Title: concise feature title
- Description: user requirements and key findings
- Team and project: from project's CLAUDE.md (Linear Integration section)

Extract the Linear ID (e.g., HL-74) for subsequent steps.

### 3. Write Specification

Create `specs/[LINEAR_ID]/spec.md`:

```markdown
# [LINEAR_ID]: [Feature Title]

## Overview
[Brief description]

## Development Mode
**Mode**: TDD | Non-TDD

## Requirements
### Must Have
- [ ] Requirement 1

### Nice to Have
- [ ] Optional requirement

## Architecture
### Approach
[Selected approach and rationale]

### Components
- [Component]: [responsibility]

### Files to Create/Modify
- `path/to/file.ts` - [purpose/changes]

## Acceptance Criteria
- [ ] Criterion 1

## Open Questions
- [NEEDS CLARIFICATION: question]
```

### 4. Generate Task List

Create `specs/[LINEAR_ID]/tasks.md`:

Read development mode from spec:
- **TDD**: Include test tasks before implementation
- **Non-TDD**: Skip test tasks

```markdown
# Tasks: [LINEAR_ID]

## Development Mode: [TDD/Non-TDD]

### Phase 1: [Name]
- [ ] T001: [Task description]
- [ ] T002: [Task description] [P]

### Phase 2: [Name]
- [ ] T003: [Task description]

## Legend
- [P] = Parallelizable
```

### 5. Request User Approval

Present spec and tasks for review before creating worktree.

### 6. Create Worktree (after approval)

```bash
MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')
cd "$MAIN_REPO"

WORKTREE_PATH="$HOME/code/feature_worktrees/[LINEAR_ID]"
mkdir -p "$HOME/code/feature_worktrees"
git worktree add "$WORKTREE_PATH" -b feature/[LINEAR_ID]

cd "$WORKTREE_PATH"

# Symlink specs directory
ln -s "$MAIN_REPO/specs/[LINEAR_ID]" specs-link

# Symlink gitignored env files at root level
# NOTE: .claude/ and .mcp.json are git-tracked — worktree already has them via checkout.
# Only symlink files that are gitignored (env files).
for env_name in .env .env.local .env.development; do
  [ -f "$MAIN_REPO/$env_name" ] && ln -sf "$MAIN_REPO/$env_name" "./$env_name"
done

# Symlink gitignored env files inside each package directory
for pkg_dir in "$MAIN_REPO"/packages/*/; do
  pkg_name=$(basename "$pkg_dir")
  worktree_pkg_dir="$WORKTREE_PATH/packages/$pkg_name"
  [ -d "$worktree_pkg_dir" ] || continue
  for env_name in .env .env.local .env.development; do
    [ -f "$pkg_dir$env_name" ] && ln -sf "$pkg_dir$env_name" "$worktree_pkg_dir/$env_name"
  done
done
```

### 7. Store Decisions in Memory

Use `mcp__memory__create_entities` to save:
- Entity name: `[LINEAR_ID]`
- Type: `feature`
- Observations: key decisions, architecture rationale, trade-offs considered

### 8. Update Linear Ticket

Add spec file location and worktree path to ticket description.

### 9. Report

Output: Linear ticket ID, spec path, worktree path, ready for `/implement [LINEAR_ID]`.
