---
description: Create feature specification with optional Linear ticket and worktree
argument-hint: "[description] — feature to specify (add --no-linear to skip Linear)"
model: opus
---

## Feature Description

$ARGUMENTS

## Plugins & Skills Composed

| Step        | Plugin/Skill                      | Purpose                                    |
| ----------- | --------------------------------- | ------------------------------------------ |
| Brainstorm  | `superpowers:brainstorming` skill | Explore intent, requirements, approaches   |
| UI Feedback | `frontend-design:frontend-design` | Visual mockup/feedback for UI features     |
| Context     | `claude-mem` plugin               | Recall past decisions and patterns         |
| Context     | `Explore` agent                   | Understand relevant codebase areas         |
| Context     | `context7` plugin                 | Fetch current library documentation        |
| Ticket      | `linear` plugin                   | Create and manage Linear ticket (optional) |
| Memory      | `claude-mem` plugin               | Store decisions for /implement             |

## Process

### 1. Parse Arguments

Check if `--no-linear` flag is present in the arguments:

- If present: skip Linear ticket creation, use date-prefixed slug as identifier
- If absent: create Linear ticket, use Linear ID + slug as identifier

Extract the feature description (everything except `--no-linear`).

### 2. Search Memory First

Use `mcp__plugin_claude-mem_mcp-search__search` for relevant patterns and past decisions before anything else.

### 3. Brainstorm (invoke skill)

**Invoke the `superpowers:brainstorming` skill.** The brainstorming skill will:

- Explore project context (files, docs, recent commits)
- Ask clarifying questions one at a time
- Propose 2-3 approaches with trade-offs and recommendation
- Present design sections for approval

**Important**: Let brainstorming run to completion. Do NOT skip to spec writing. Its output feeds directly into spec.md.

**FLOW OVERRIDE**: The brainstorming skill will try to invoke `superpowers:writing-plans` and write a design doc to `docs/plans/`. **Do NOT follow that exit.** Instead:

- Skip `writing-plans` — this command handles spec writing in step 6
- Skip design doc creation — capture all brainstorming output into `specs/active/[FEATURE_ID]/spec.md` instead
- The spec includes an "Alternatives Considered" section for rejected approaches

**If the feature has UI components**: During the design presentation step, invoke `frontend-design:frontend-design` to generate a visual mockup or prototype. Present this alongside the design for user feedback before finalizing.

### 4. Generate Identifier

Derive a short slug from the feature description (lowercase, hyphens, max 50 chars).

- **Without `--no-linear`**: Use a temporary date-prefixed slug for now. The Linear ticket will be created after specs are written (step 13), and the worktree/branch will be renamed to include the Linear ID.
- **With `--no-linear`**: `[YYYY-MM-DD]-[slug]` (e.g., `2026-03-02-add-auth-flow`) — this is the final identifier.

This identifier is used for:

- Worktree path: `~/code/feature_worktrees/[ID]`
- Branch name: `feature/[ID]`

### 5. Create Worktree

```bash
MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')
FEATURE_ID="[generated-identifier]"
WORKTREE_PATH="$HOME/code/feature_worktrees/$FEATURE_ID"

mkdir -p "$HOME/code/feature_worktrees"
cd "$MAIN_REPO"
git worktree add "$WORKTREE_PATH" -b "feature/$FEATURE_ID"

# Create specs directory structure
mkdir -p "$WORKTREE_PATH/specs/active/$FEATURE_ID/diagrams"
mkdir -p "$WORKTREE_PATH/specs/archived"

# Symlink all gitignored env files
find "$MAIN_REPO" -maxdepth 4 -name '.env*' -not -path '*/node_modules/*' -not -path '*/.git/*' | while read env_file; do
  rel_path="${env_file#$MAIN_REPO/}"
  mkdir -p "$WORKTREE_PATH/$(dirname "$rel_path")"
  ln -sf "$env_file" "$WORKTREE_PATH/$rel_path"
done

# Install dependencies
cd "$WORKTREE_PATH"
# Refer to project's CLAUDE.md for the correct package manager and setup commands
```

### 6. Write Specification

Create `specs/active/[FEATURE_ID]/spec.md` inside the worktree using brainstorming output:

```markdown
# [FEATURE_ID]: [Feature Title]

## Overview

[From brainstorming — concise description of what this builds]

## Development Mode

**Mode**: TDD | Non-TDD

## Requirements

### Must Have

- [ ] Requirement 1

### Nice to Have

- [ ] Optional requirement

## Architecture

[From brainstorming — selected approach and rationale]

### Components

- [Component]: [responsibility]

### Files to Create/Modify

- `path/to/file.ts` - [purpose/changes]

### Library References

- [Library]: [relevant API/pattern from context7 docs]

## Alternatives Considered

[From brainstorming — rejected approaches and why they were not chosen]

### [Approach Name]

- **Pros**: ...
- **Cons**: ...
- **Why rejected**: ...

## Acceptance Criteria

- [ ] Criterion 1

## Open Questions

- [NEEDS CLARIFICATION: question]
```

### 7. Generate Diagrams

After writing the spec, use the `feature-dev:code-architect` agent to assess complexity and generate appropriate diagrams.

**Dispatch an architect agent** with the spec content and ask it to:

1. Assess feature complexity (small / medium / large)
2. Decide which diagram types best communicate the architecture
3. Generate Mermaid syntax for each diagram

**Complexity-based diagram selection:**

- **Small feature** (single component, few files): Simple flowchart or sequence diagram
- **Medium feature** (multiple components, cross-cutting): Architecture diagram showing affected components and relationships
- **Large feature / refactor** (system-wide changes): Before/after comparison diagrams showing current vs proposed architecture

**Save diagrams** as `.mmd` files in `specs/active/[FEATURE_ID]/diagrams/`:

- `architecture.mmd` — overall architecture (medium/large features)
- `flow.mmd` — control or data flow (if applicable)
- `before.mmd` + `after.mmd` — before/after comparison (large features / refactors)

**Render via draw.io:**
Use `mcp__drawio__open_drawio_mermaid` to open each diagram for the user to see.

**Update spec.md** to reference diagrams:
Add a "## Diagrams" section to `specs/active/[FEATURE_ID]/spec.md` listing the generated diagram files with brief descriptions.

### 8. Agent Reviews (before user sign-off)

Before presenting to the user, run context-dependent agent reviews on the spec and diagrams.

**Determine which reviews are needed** based on spec content:

- If spec involves UI components/pages/styling → invoke `frontend-design:frontend-design` skill for UI/UX review
- If spec involves backend architecture/APIs/data models → dispatch `feature-dev:code-architect` agent for architecture review
- If spec is full-stack → dispatch both in parallel

**Dispatch reviews in parallel** using the Agent tool:

- Each reviewer receives: `specs/active/[FEATURE_ID]/spec.md`, `specs/active/[FEATURE_ID]/tasks.md`, and any diagrams
- Each reviewer scores findings as: **critical** (must fix), **suggestion** (worth considering), or **nitpick** (minor)

**Feedback loop:**

1. Collect all review feedback
2. If there are **critical** findings:
   a. Revise spec.md, tasks.md, and/or diagrams to address critical issues
   b. Re-run only the review agents that raised critical issues
   c. Repeat until no critical findings remain (max 2 iterations)
3. Compile a **Review Summary** section

**Add to spec.md:** Append a "## Review Summary" section at the end.

### 9. Generate Task List

Create `specs/active/[FEATURE_ID]/tasks.md` inside the worktree:

Read development mode from spec:

- **TDD**: Include test tasks before implementation (tasks reference `superpowers:test-driven-development` skill)
- **Non-TDD**: Skip test tasks

```markdown
# Tasks: [FEATURE_ID]

## Development Mode: [TDD/Non-TDD]

### Phase 1: [Name]

- [ ] T001: [Short title] (depends: T000) [P]
  - **Why**: [Which spec requirement/acceptance criterion this satisfies]
  - **Files**: [Files to create or modify]
  - **Done when**: [Concrete completion criteria — what must be true]

### Phase 2: [Name]

- [ ] T003: [Short title] (depends: T002)
  - **Why**: [Requirement reference]
  - **Files**: [File list]
  - **Done when**: [Completion criteria]

## Status Legend

- [ ] = Pending
- [→] = In Progress
- [x] = Done
- [~] = Skipped
- [P] = Parallelizable (no dependency between [P] siblings)
```

**Task description rules:**

- **Why**: Must reference a specific requirement from spec.md
- **Files**: List every file the task creates or modifies
- **Done when**: Concrete, verifiable criteria

**Dependency rules:**

- Sequential tasks within a phase: each depends on the previous
- Parallel `[P]` tasks: all depend on the last sequential task before them
- First task after a `[P]` group: depends on ALL `[P]` tasks in the group
- Cross-phase: first task of Phase N depends on last task of Phase N-1

### 10. Review with User

Present the spec and tasks for user review before committing:

- Show `specs/active/[FEATURE_ID]/spec.md`
- Show `specs/active/[FEATURE_ID]/tasks.md`
- Mention the Review Summary findings
- Ask user to approve, request changes, or adjust scope

**Wait for user approval before proceeding.**

### 11. Store Decisions in Memory

Use `mcp__plugin_claude-mem_mcp-search__save_observation` to save key decisions:

- Project: `[FEATURE_ID]`
- Key decisions and architecture rationale
- Trade-offs considered
- Library patterns to use
- Why rejected approaches were not chosen

### 12. Commit Specs

```bash
cd "$WORKTREE_PATH"
git add specs/
git commit -m "feat: add spec and tasks for [FEATURE_ID]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### 13. Create Linear Ticket (unless --no-linear)

If `--no-linear` was NOT specified:

Use `mcp__plugin_linear_linear__create_issue`:

- Title: concise feature title
- Description: spec overview, requirements summary, and worktree path
- Team and project: from project's CLAUDE.md (Linear Integration section)

Extract the Linear ID (e.g., HL-80). Update the spec.md title to include the Linear ID.

### 14. Report

Output:

- Linear ticket ID and URL (if created)
- Feature ID: `[FEATURE_ID]`
- Worktree path: `~/code/feature_worktrees/[FEATURE_ID]`
- Spec: `specs/active/[FEATURE_ID]/spec.md`
- Tasks: `specs/active/[FEATURE_ID]/tasks.md`
- Branch: `feature/[FEATURE_ID]`
- Ready for `/implement [FEATURE_ID]`
