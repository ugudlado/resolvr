# 2026-03-06-code-task-view-revamp: Code & Task View Design Revamp

## Overview

Unify the visual design language across the entire review app by migrating the Code Review and Task views to the Notion dark theme established in the spec-view-revamp (2026-03-05). The spec view already uses Notion dark with DM Sans/Newsreader typography, inline threading (InlineThread), and a slim ThreadNav panel. The code and task views still use the legacy terminal-luxe GitHub dark theme with system fonts and panel-only threading.

This revamp brings:

- **Code Review View**: Notion dark chrome around the existing `@git-diff-view/react` diff (which keeps terminal-luxe syntax colors), inline thread cards in the diff, and a slim ThreadNav replacing the 320px CodeThreadsPanel.
- **Task View**: Notion dark theme with progress ring, collapsible phase timeline, expandable task details, and dependency chain visualization.

## Development Mode

**Mode**: Non-TDD

## Requirements

### Must Have

- [ ] R1: Notion dark theme (canvas/ink/accent tokens) applied to all Code Review and Task view chrome (headers, panels, sidebars, cards)
- [ ] R2: DM Sans / Newsreader / JetBrains Mono typography across both views
- [ ] R3: Terminal-luxe syntax colors preserved inside the diff code area only
- [ ] R4: Inline thread cards (blocking/suggestion/resolved states) rendered inside diff rows, matching InlineThread component patterns from spec view
- [ ] R5: ThreadNav slim panel (240px) replaces CodeThreadsPanel (320px) in code review, with Open/Resolved tabs and click-to-scroll
- [ ] R6: File sidebar restyled with Notion dark tokens, search input, file group labels, M/A/D status badges, thread count badges
- [ ] R7: FeatureNavBar two-row layout used consistently across all views (already exists, ensure Code/Task views use it)
- [ ] R8: Verdict buttons (Approve / Request Changes) in FeatureNavBar for code review view
- [ ] R9: Task view progress header with SVG progress ring, feature title (Newsreader), mode badge, stats row
- [ ] R10: Collapsible phase cards with mini progress bars and task counts
- [ ] R11: Task items with status icons (done/in-progress/pending/skipped), task ID, title, dependency/file tags
- [ ] R12: Expandable task details showing Why, Files, Done-when fields
- [ ] R13: Dependency chain dot visualization on in-progress tasks

### Nice to Have

- [ ] N1: Animated pulse glow on in-progress task status icons
- [ ] N2: Smooth scroll + ring highlight when clicking thread in ThreadNav
- [ ] N3: Keyboard navigation between threads (j/k) in code review
- [ ] N4: Phase collapse state persisted in localStorage

## Architecture

### Approach: Notion-Wrapped Diff + Phase Timeline

**Code Review**: Keep the proven 3-panel layout (file sidebar + diff + thread nav) but wrap all non-code chrome in Notion dark tokens. The `@git-diff-view/react` library continues to render diffs with terminal-luxe syntax colors — only the surrounding UI (file header, sidebar, panels, inline thread cards) gets the Notion treatment. Inline threads use the same `InlineThread` component pattern from the spec view, adapted for diff-line anchors.

**Task View**: Replace the minimal TaskBoard wrapper with a phase timeline layout. Progress ring (SVG) at the top, collapsible phase cards below, each containing task items with status icons and expandable details.

### Important: Dead Code

`CodeReviewPage.tsx` exists but is NOT imported or routed anywhere (verified in `App.tsx`). All code review work targets `ReviewPage.tsx`, which is the actively routed component. `CodeReviewPage.tsx` should be ignored (and optionally deleted during cleanup).

### Theme Strategy

- Notion dark CSS variables are already in `notion-theme.css` (global `:root`)
- Terminal-luxe variables remain for diff syntax area only
- Shared components (ThreadCard, ComposeBox, ReviewVerdict) still use terminal-luxe tokens — need full migration to Notion dark
- Google Fonts already loaded in `index.html` — apply `font-family` to code review and task containers

### CSS Override for @git-diff-view/react Extend Rows

**Critical**: The library's `.diff-line-extend-wrapper *` CSS rule resets `color` to `initial` (black) inside extend rows. The current `index.css` override (lines 309-315) patches this using `--text-primary` (terminal-luxe). Since `DiffInlineThread` will use Notion dark tokens (`--ink`, `--canvas`, etc.), the override must be extended to also set Notion dark CSS variables, or `DiffInlineThread` must wrap its content in a scoped container that sets `color: var(--ink)` explicitly.

### Task Title Display

The `TaskProgress` type only has `featureId` (e.g. `"2026-03-06-code-task-view-revamp"`), not a human-readable title. `TaskTimeline` should format the featureId by stripping the date prefix and converting hyphens to spaces with title case (e.g. "Code Task View Revamp"). No new data field needed — pure display formatting.

### Components to Create

- `DiffInlineThread` — Adapter that renders InlineThread inside a diff table row (handles the `<tr>` portal injection pattern)
- `DiffThreadNav` — Code-review-specific ThreadNav that shows file:line labels instead of spec section labels
- `TaskTimeline` — New task view layout component (replaces TaskBoard)
- `PhaseSection` — Collapsible phase card with progress bar
- `TaskRow` — Individual task item with status icon, tags, expandable details
- `ProgressRing` — SVG circular progress indicator
- `DepChain` — Dependency chain dot visualization

### Components to Modify

- `ReviewPage.tsx` — Replace CodeThreadsPanel with DiffThreadNav, add inline thread rendering, apply Notion dark classes
- `TasksPage.tsx` — Replace TaskBoard with TaskTimeline
- `FileSidebar` (or file tree section in ReviewPage) — Restyle with Notion dark tokens
- `ReviewVerdict.tsx` — Already Notion-styled, ensure it integrates into FeatureNavBar context for code review
- `ThreadCard.tsx` — Complete migration from terminal-luxe to Notion dark tokens
- `ThreadStatusTabs.tsx` — Migrate to Notion dark tokens

### Files to Create

- `apps/ui/src/components/diff/DiffInlineThread.tsx`
- `apps/ui/src/components/diff/DiffThreadNav.tsx`
- `apps/ui/src/components/tasks/TaskTimeline.tsx`
- `apps/ui/src/components/tasks/PhaseSection.tsx`
- `apps/ui/src/components/tasks/TaskRow.tsx`
- `apps/ui/src/components/shared/ProgressRing.tsx`
- `apps/ui/src/components/shared/DepChain.tsx`

### Files to Modify

- `apps/ui/src/pages/ReviewPage.tsx`
- `apps/ui/src/pages/TasksPage.tsx`
- `apps/ui/src/components/shared/ThreadCard.tsx`
- `apps/ui/src/components/shared/ThreadStatusTabs.tsx`
- `apps/ui/src/components/review/CodeThreadsPanel.tsx` (may be removed/replaced)
- `apps/ui/src/components/sidebar/` (file sidebar components)

### Library References

- `@git-diff-view/react` — Existing diff library, `extendData` + `renderExtendLine` for inline thread injection
- InlineThread/ThreadNav patterns from `apps/ui/src/components/spec/` — Reuse design, adapt for diff context

## Alternatives Considered

### A: Full Theme Replacement (terminal-luxe removed entirely)

- **Pros**: Single theme, no variable conflicts
- **Cons**: Diff syntax highlighting is designed around GitHub dark colors; changing it reduces readability and familiarity for developers
- **Why rejected**: Syntax colors in diffs are a specialized concern — developers expect GitHub-style coloring. Notion dark is better for chrome/UI, terminal-luxe better for code.

### B: Content-First Single-Column Layout (GitHub PR style)

- **Pros**: Simpler, familiar to GitHub users
- **Cons**: Loses persistent file sidebar (important for large reviews), major layout rewrite, less information density
- **Why rejected**: The current 3-panel layout is proven and useful. Restyling is lower risk than restructuring.

### C: Resizable Panels

- **Pros**: Maximum user flexibility
- **Cons**: Complex to implement well, edge cases (min widths, persistence), not worth the effort for a design revamp
- **Why rejected**: Added complexity without proportional benefit. Fixed widths matching spec view (240px sidebars) are sufficient.

### D: Status Kanban for Tasks

- **Pros**: Quick status overview at a glance
- **Cons**: Loses phase context, tasks from different phases get mixed, doesn't match tasks.md structure
- **Why rejected**: Phase timeline better matches the spec-driven workflow where tasks are organized by phase with dependencies.

## Acceptance Criteria

- [ ] AC1: Navigating between Spec, Code, and Tasks tabs shows a visually cohesive app — same theme, typography, and spacing patterns
- [ ] AC2: Diff code area retains terminal-luxe syntax colors and is readable
- [ ] AC3: Inline thread cards appear below their anchored diff lines with correct severity styling
- [ ] AC4: ThreadNav panel shows thread list with file:line labels, clicking scrolls to inline thread
- [ ] AC5: File sidebar shows grouped files with status and thread count badges
- [ ] AC6: Task view shows progress ring, collapsible phases, and expandable task details
- [ ] AC7: All existing review functionality (compose, reply, resolve, verdict) works after restyling
- [ ] AC8: Type-check passes (`pnpm type-check`)
- [ ] AC9: Visual verification confirms mockup fidelity

## Diagrams

- `diagrams/architecture.mmd` — Component architecture showing Notion dark wrapper around terminal-luxe diff core

## Review Summary

### Agent: frontend design reviewer (feature-dev:code-reviewer)

**Critical issues found and resolved:**

1. **CodeReviewPage.tsx ambiguity** — Dead file exists alongside active ReviewPage.tsx. Resolved: Added "Dead Code" section to Architecture noting CodeReviewPage.tsx is not routed and should be ignored.
2. **CSS color reset in diff extend rows** — `@git-diff-view/react` resets `color` to `initial` in `.diff-line-extend-wrapper`, which would make Notion dark tokens render as black text. Resolved: Added "CSS Override" section to Architecture and updated T006 to include scoped color wrapper.
3. **Missing feature title field** — `TaskProgress` type has `featureId` but no human-readable title. Resolved: Added "Task Title Display" section specifying runtime formatting of featureId (strip date, hyphen-to-space, title case). No schema change needed.

**Suggestions incorporated:**

- T011 now includes explicit removal of old verdict buttons from ReviewPage JSX and lists ReviewVerdict.tsx in Files
- T008 dependency updated to include T007 (needs inline thread DOM for click-to-scroll)
- T013 updated to receive sibling task list for DepChain forward-link display
- T019 now depends on T018 (functionality check before type-check)
- N4 (localStorage persistence) left as nice-to-have, out of scope for this iteration

## Open Questions

None — design approved via HTML mockups.
