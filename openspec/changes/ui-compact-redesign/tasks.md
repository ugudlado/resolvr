# Tasks: UI Compact Redesign — Dashboard & FeatureNavBar

## Phase 1: FeatureRow Component

- [x] T-1 Create `apps/ui/src/components/dashboard/FeatureRow.tsx` with CSS grid layout (`grid-template-columns: 2.5fr 1fr 1.5fr 1.2fr auto`), left 3px border accent per status (`ROW_ACCENT` map using design tokens: `accent-emerald` not `emerald-500`), hover `translate-x-1`, click navigates to feature. Include keyboard accessibility: `role="link"`, `tabIndex={0}`, Enter/Space activation, `focus-visible` ring.
- [x] T-2 Implement all 5 grid cells: (1) monospace title + branch with search highlight, (2) status pill uppercase, (3) metrics (thread icon + open count, file icon + file count), (4) linear progress bar (`h-1 bg-ink-ghost` track, `bg-accent-blue` fill, `bg-accent-emerald` when 100%) with `done/total Tasks` label — hide column when `total === 0`, (5) relative time
- [x] T-3 Create `apps/ui/src/components/dashboard/SkeletonRow.tsx` matching the row grid layout with `animate-pulse` placeholders [P]
- [x] T-4 Review checkpoint — visual inspection of FeatureRow and SkeletonRow (phase gate)

## Phase 2: Dashboard Redesign

- [x] T-5 Update `Dashboard.tsx`: add `statusFilter` state (`FeatureStatus | 'all'`), remove `completedOpen` state, remove `ChevronIcon` component, remove `isCompleted` helper (depends: T-1)
- [x] T-6 Update `useMemo` filter+sort in `Dashboard.tsx`: apply both `searchQuery` and `statusFilter` filters; use two-group sort (active first, completed second, each group sorted by `sortKey`); update `searchCount` to reflect combined filter result (depends: T-5)
- [x] T-7 Update `Dashboard.tsx` controls bar: make search input full-width (`flex-1`), add status filter dropdown (All, New, Design, Design Review, Code, Code Review, Complete) alongside sort dropdown (depends: T-5)
- [x] T-8 Replace card grid render in `Dashboard.tsx` with flat `flex-col gap-2` list of `FeatureRow` components; completed features rendered inline with `opacity-60`. Preserve `EmptyState` component for zero-features condition; preserve "No features matching" message for empty filter/search results (depends: T-1, T-5)
- [x] T-9 Replace `SkeletonCard` loading placeholders with `SkeletonRow` (depends: T-3, T-8)
- [x] T-10 Delete unused `FeatureCard.tsx`, `SkeletonCard.tsx`, and `PipelineDots.tsx` (depends: T-9)
- [x] T-11 Review checkpoint — dashboard renders row list, filter and sort work, loading/error/empty states correct (phase gate)

## Phase 3: FeatureNavBar Single-Row

- [x] T-12 Merge two-row layout in `FeatureNavBar.tsx` into single `<header>` with one `flex items-center` row; remove the separate `<nav>` element
- [x] T-13 Add `STATUS_DOT` and `STATUS_DOT_GLOW` maps; replace status badge inside feature switcher button with colored 8px dot + glow box-shadow (depends: T-12)
- [x] T-14 Move tab pills from the old row 2 `<nav>` into the single row, positioned after the feature switcher with a `mx-2` divider. **Preserve `FLAGS.DEV_WORKFLOW` guard** — tabs only render when the flag is enabled (depends: T-12)
- [x] T-15 Move `ml-auto` section (worktree path + copy + header actions) to end of single row (depends: T-12)
- [x] T-16 Review checkpoint — single-row navbar renders correctly (min viewport 1024px); all tab badges, dropdown, copy, and header actions work. Note: Spec tab from mockup is intentionally excluded per spec R11 (phase gate)

<!-- Status markers: [ ] pending, [→] in-progress, [x] done -->
<!-- [P] = parallelizable, (depends: T-xxx) = dependency -->
