---
description: Create Linear ticket and feature specification from natural language description
model: opus
---

## Feature Description

$ARGUMENTS

## Plugins & Tools Used

| Step | Plugin/Tool | Purpose |
|------|-------------|---------|
| Context | `memory` MCP | Recall past decisions and patterns |
| Context | `Explore` agent | Understand relevant codebase areas |
| Context | `context7` plugin | Fetch current library documentation |
| Design | `sequential-thinking` MCP | Evaluate multiple approaches systematically |
| Ticket | `linear` plugin | Create and manage Linear ticket |
| Memory | `memory` MCP | Store decisions for /implement |

## Process

### 1. Gather Context

**a. Search Memory**
- Use `mcp__memory__search_nodes` for relevant patterns and past decisions

**b. Explore Codebase**
- Use Task tool with `subagent_type=Explore` to understand the relevant codebase area
- Identify existing patterns, conventions, and integration points

**c. Fetch Documentation**
- Use `mcp__plugin_context7_context7__resolve-library-id` to find relevant libraries
- Use `mcp__plugin_context7_context7__query-docs` for current API documentation
- Query docs for libraries that will be used in implementation (e.g., Zustand, Expo APIs, React Native)

### 2. Create Linear Ticket

Use `mcp__plugin_linear_linear__create_issue`:
- Title: concise feature title
- Description: user requirements and key findings
- Team and project: from project's CLAUDE.md (Linear Integration section)

Extract the Linear ID (e.g., HL-74) for subsequent steps.

### 3. Evaluate Approaches

Use `mcp__sequential-thinking__sequentialthinking` to systematically evaluate implementation approaches:

**Step 1**: Identify 2-4 viable approaches based on context gathered
- Consider existing patterns in codebase
- Consider library best practices from context7 docs
- Consider trade-offs (complexity, performance, maintainability)

**Step 2**: For each approach, analyze:
- Pros and cons
- Fit with existing architecture
- Implementation complexity
- Future extensibility

**Step 3**: Select best approach with clear rationale

**Step 4**: Verify selection against requirements

Document the evaluation in the spec (see Architecture section below).

### 4. Write Specification

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

### Approaches Considered
| Approach | Pros | Cons |
|----------|------|------|
| [Approach 1] | [pros] | [cons] |
| [Approach 2] | [pros] | [cons] |

### Selected Approach
**[Approach name]**: [rationale for selection]

### Components
- [Component]: [responsibility]

### Files to Create/Modify
- `path/to/file.ts` - [purpose/changes]

### Library References
- [Library]: [relevant API/pattern from context7 docs]

## Acceptance Criteria
- [ ] Criterion 1

## Open Questions
- [NEEDS CLARIFICATION: question]
```

### 5. Generate Task List

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

### 6. Request User Approval

Present spec and tasks for review before creating worktree.

### 7. Create Worktree (after approval)

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

# Symlink gitignored env files inside each subdirectory that has them
for sub_dir in "$MAIN_REPO"/*/; do
  sub_name=$(basename "$sub_dir")
  worktree_sub_dir="$WORKTREE_PATH/$sub_name"
  [ -d "$worktree_sub_dir" ] || continue
  for env_name in .env .env.local .env.development; do
    [ -f "$sub_dir$env_name" ] && ln -sf "$sub_dir$env_name" "$worktree_sub_dir/$env_name"
  done
done
```

### 8. Store Decisions in Memory

Use `mcp__memory__create_entities` to save:
- Entity name: `[LINEAR_ID]`
- Type: `feature`
- Observations:
  - Key decisions and architecture rationale
  - Trade-offs considered (from sequential-thinking evaluation)
  - Library patterns to use (from context7 docs)
  - Why rejected approaches were not chosen

### 9. Update Linear Ticket

Use `mcp__plugin_linear_linear__update_issue` to add:
- Spec file location
- Worktree path
- Selected approach summary

### 10. Report

Output:
- Linear ticket ID and URL
- Spec path: `specs/[LINEAR_ID]/spec.md`
- Tasks path: `specs/[LINEAR_ID]/tasks.md`
- Worktree path: `~/code/feature_worktrees/[LINEAR_ID]`
- Ready for `/implement [LINEAR_ID]`
