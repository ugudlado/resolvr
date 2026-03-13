---
mode: non-tdd
feature-id: 2026-03-12-ui-compact-redesign
linear-ticket: none
---

# Specification: UI Compact Redesign — Dashboard & FeatureNavBar

## Overview

Replace the 2-column card grid dashboard with a compact single-column row list, and collapse the two-row FeatureNavBar into a single row. The redesign matches the visual style of `ux-redesign-mockup.html`, using existing Notion Dark design tokens. Task progress uses a linear progress bar (matching the mockup), while thread counts continue using `ThreadProgressRing`.

## Requirements

### Functional

1. Dashboard displays all features in a single-column list, sorted by last activity by default.
2. Each row shows: feature title (monospace) + git branch, status pill, metrics (open threads + files changed), task progress bar (linear, matching mockup's `.progress-track`/`.progress-fill` pattern), and relative time.
3. Rows have a 3px left border accent colored per status (amber = review, blue = code, emerald = complete, slate = new, purple = design).
4. Hovering a row slides it right by 4px (`translateX(4px)`); clicking or pressing Enter/Space on a focused row navigates to the feature. Rows must preserve keyboard accessibility (`role="link"`, `tabIndex={0}`, Enter/Space activation, `focus-visible` styling).
5. Completed features appear inline in the same list (no collapsible section), with a green left border and dimmed opacity.
6. Dashboard controls include: full-width search input (with search icon), sort dropdown (Last Active, Status, Name), status filter dropdown (All, New, Design, Code, Code Review, Design Review, Complete), and a Refresh button.
7. Loading state renders skeleton rows matching the row layout (not card layout).
8. FeatureNavBar collapses from two rows to a single row containing (left to right): back link, separator, feature switcher (with colored status dot, feature name, chevron), tab pills (Tasks, Code with existing badges), worktree path, and header actions slot. The `FLAGS.DEV_WORKFLOW` guard on tabs must be preserved in the single-row layout.
9. The feature switcher shows a small colored status dot (8px circle with box-shadow glow) matching the status color, replacing the full status badge.
10. All existing FeatureNavBar behavior is preserved: dropdown, outside-click close, feature search, copy worktree path, tab availability logic, thread count badge on Code tab, task progress on Tasks tab.
11. The Spec tab shown in the mockup is intentionally excluded — do not add it. This is an approved divergence from the mockup.
12. Minimum supported viewport width: 1024px (desktop-only app). No responsive collapse is required below this width.

### Non-Functional

1. Row hover transition uses `transition-all duration-200`.
2. No new npm dependencies — reuse existing components and design tokens.
3. The existing `FeatureCard` component is replaced; `SkeletonCard` is replaced by a row-layout skeleton.
4. Design tokens used exclusively from existing Notion Dark set (`canvas-raised`, `ink`, `ink-muted`, `ink-faint`, `ink-ghost`, `accent-*`, `border`).

## Architecture

### Files Changed

- `apps/ui/src/pages/Dashboard.tsx` — render logic, filter state, row list layout
- `apps/ui/src/components/dashboard/FeatureCard.tsx` — replaced by `FeatureRow.tsx`
- `apps/ui/src/components/dashboard/FeatureRow.tsx` — new compact row component
- `apps/ui/src/components/dashboard/SkeletonCard.tsx` — updated to row layout (or new `SkeletonRow.tsx`)
- `apps/ui/src/components/FeatureNavBar.tsx` — collapsed to single row

### Row Grid Layout

```
grid-cols: [2.5fr title+branch] [1fr status pill] [1.5fr metrics] [1.2fr progress bar] [auto time]
```

### Status Dot Colors (FeatureNavBar)

Map `FeatureStatus` → Tailwind color class for the dot background:

- `new` → `bg-slate-500`
- `design` → `bg-purple-500`
- `design_review` → `bg-accent-amber`
- `code` → `bg-accent-blue`
- `code_review` → `bg-accent-amber`
- `complete` → `bg-accent-emerald`

### Left Border Accent Colors (FeatureRow)

- `new` → `border-l-slate-600`
- `design` → `border-l-purple-500`
- `design_review` → `border-l-accent-amber`
- `code` → `border-l-accent-blue`
- `code_review` → `border-l-accent-amber`
- `complete` → `border-l-accent-emerald`

## Acceptance Criteria

1. **Given** features exist, **when** the dashboard loads, **then** features appear as a single-column list sorted by last activity, each row showing all 5 grid columns.
2. **Given** a feature row, **when** hovered, **then** the row translates right by 4px and the border brightens.
3. **Given** a feature row, **when** clicked, **then** the user navigates to `/features/:featureId`.
4. **Given** the status filter is set to "Code Review", **when** the list renders, **then** only features with `code_review` status are shown.
5. **Given** a completed feature, **when** it appears in the list, **then** it has a green left border and `opacity-60`.
6. **Given** the FeatureNavBar, **when** rendered, **then** all elements appear in a single horizontal row within a `canvas-raised` container with rounded corners.
7. **Given** the feature switcher button in the navbar, **when** rendered, **then** a colored 8px status dot appears instead of the full status badge text.
8. **Given** the Code tab has open threads, **when** rendered, **then** the amber badge count is visible in the single-row layout.

## Decisions

- **Non-TDD mode**: Pure UI/styling changes with no business logic; visual correctness is validated by inspection, not unit tests.
- **New `FeatureRow` component** (not modifying `FeatureCard`): The layout model is fundamentally different (CSS grid row vs flex column card). Keeping both as separate files preserves clarity and makes rollback easier.
- **Flat completed list with active-first sort**: Eliminates the collapsible `completedOpen` state. Active features sorted by `lastActivity` appear first; completed features (sorted by `lastActivity`) appear after. This matches user intent — recently completed items don't leap to the top of the list.
- **Linear progress bar for task progress**: Uses the mockup's `.progress-track`/`.progress-fill` pattern (not `ThreadProgressRing`, which is semantically thread-specific with `resolved/open` API and thread-specific tooltips). `ThreadProgressRing` remains unchanged and used only for thread metrics in the metrics column.
- **Status filter is additive with search**: Both `searchQuery` and `statusFilter` narrow the list independently using `useMemo`. `searchCount` reflects the combined filtered result.
- **`FLAGS.DEV_WORKFLOW` preserved**: Tab visibility in navbar and task/status elements in rows remain gated by the feature flag.

## Review Summary

Reviews conducted by [codex] and [claude-review] agents. All critical findings addressed in artifact revision.

| #   | Severity   | Finding                                                       | Resolution                                            | Source                  |
| --- | ---------- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| C-1 | Critical   | `ThreadProgressRing` API mismatch — wrong semantics for tasks | Changed to linear progress bar matching mockup        | [codex] [claude-review] |
| C-2 | Critical   | `FLAGS.DEV_WORKFLOW` guard unmentioned in navbar merge        | Preserved in spec R8, design, and task T-14           | [codex] [claude-review] |
| C-3 | Critical   | Completed features sort contradiction                         | Fixed: two-group sort (active first, complete second) | [codex]                 |
| C-4 | Critical   | `searchCount` not updated for `statusFilter`                  | Fixed: combined filter result in design/task T-6      | [claude-review]         |
| S-1 | Suggestion | Keyboard accessibility missing from FeatureRow                | Added to spec R4, design, and task T-1                | [claude-review]         |
| S-2 | Suggestion | `EmptyState` + no-results state not in tasks                  | Added to design and task T-8                          | [claude-review]         |
| S-3 | Suggestion | Design token `emerald-500` vs `accent-emerald`                | Fixed to `accent-emerald` in design                   | [claude-review]         |
| S-4 | Suggestion | Narrow viewport strategy undefined                            | Added min 1024px in spec R12                          | [codex]                 |
| N-1 | Nitpick    | Template literal typo in design click handler                 | Fixed                                                 | [claude-review]         |
| N-2 | Nitpick    | `ChevronIcon`/`isCompleted` dead code                         | Added to task T-5                                     | [claude-review]         |
| N-3 | Nitpick    | Spec tab in mockup but excluded                               | Documented in spec R11 and task T-16                  | [codex] [claude-review] |
