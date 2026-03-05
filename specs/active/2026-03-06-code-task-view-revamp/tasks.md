# Tasks: 2026-03-06-code-task-view-revamp

## Development Mode: Non-TDD

### Phase 1: Shared Component Migration

- [x] T001: Migrate ThreadCard from terminal-luxe to Notion dark tokens [P]
  - **Why**: R1 — All shared components must use Notion dark theme for visual consistency
  - **Files**: `apps/ui/src/components/shared/ThreadCard.tsx`
  - **Done when**: ThreadCard uses canvas/ink/accent CSS variables instead of bg-primary/text-primary, DM Sans font applied

- [x] T002: Migrate ThreadStatusTabs from terminal-luxe to Notion dark tokens [P]
  - **Why**: R1 — Tab styling must match Notion dark theme used in ThreadNav
  - **Files**: `apps/ui/src/components/shared/ThreadStatusTabs.tsx`
  - **Done when**: Tabs use ink/canvas/accent-blue tokens, border-bottom indicator matches ThreadNav pattern

- [x] T003: Create ProgressRing shared component [P]
  - **Why**: R9 — Task view needs circular SVG progress indicator
  - **Files**: `apps/ui/src/components/shared/ProgressRing.tsx`
  - **Done when**: SVG ring renders with configurable percentage, emerald accent color, percentage text centered, animates on mount

- [x] T004: Create DepChain shared component [P]
  - **Why**: R13 — In-progress tasks show dependency chain as colored dots
  - **Files**: `apps/ui/src/components/shared/DepChain.tsx`
  - **Done when**: Renders a horizontal chain of colored dots (done=emerald, current=blue, pending=ghost) connected by lines

### Phase 2: Code Review — File Sidebar Restyle

- [ ] T005: Restyle file sidebar with Notion dark theme (depends: T001)
  - **Why**: R6 — File sidebar must use Notion dark tokens with search, group labels, and status badges
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx` (sidebar section), sidebar components in `apps/ui/src/components/sidebar/`
  - **Done when**: Sidebar uses canvas-raised background, DM Sans typography, search input with border/accent-blue focus, file items with M/A/D colored badges, amber thread count badges

### Phase 3: Code Review — Inline Threading

- [ ] T006: Create DiffInlineThread component (depends: T005)
  - **Why**: R4 — Inline thread cards must render inside diff table rows
  - **Files**: `apps/ui/src/components/diff/DiffInlineThread.tsx`, `apps/ui/src/index.css`
  - **Done when**: Component wraps InlineThread pattern in a `<tr>` with proper colspan, handles blocking/suggestion/resolved severity styles, pointer arrow positioned correctly relative to diff line. Must include a scoped CSS wrapper that sets `color: var(--ink)` to override the library's `.diff-line-extend-wrapper *` color reset (see index.css lines 309-315)

- [ ] T007: Wire inline threads into diff via extendData (depends: T006)
  - **Why**: R4 — Threads must appear below their anchored diff lines using @git-diff-view/react's extendData API
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: Threads with diff-line anchors render as inline cards below the target line, clicking "+" on a line opens compose flow, new threads appear inline after creation

- [ ] T008: Create DiffThreadNav component (depends: T006, T007)
  - **Why**: R5 — Replace 320px CodeThreadsPanel with slim 240px ThreadNav adapted for code review. Note: depends on T007 so inline thread DOM elements exist for click-to-scroll navigation.
  - **Files**: `apps/ui/src/components/diff/DiffThreadNav.tsx`
  - **Done when**: 240px right panel shows Open/Resolved tabs, thread cards with file:line labels (not spec section labels), click navigates to inline thread in diff

- [ ] T009: Replace CodeThreadsPanel with DiffThreadNav in ReviewPage (depends: T007, T008)
  - **Why**: R5 — Complete the transition from old panel-only threading to inline + nav pattern
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: ReviewPage uses DiffThreadNav instead of CodeThreadsPanel, threads show inline in diff AND in nav panel, click-to-scroll works from nav to inline thread

### Phase 4: Code Review — Chrome & Header

- [ ] T010: Apply Notion dark theme to diff file header and mode toggle (depends: T005)
  - **Why**: R1, R2 — Diff area chrome (file path header, Unified/Split toggle, stats) must use Notion dark
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: File header bar uses canvas-raised background, JetBrains Mono for file path, DM Sans for mode toggle, stats use code-add-text/code-del-text colors

- [ ] T011: Integrate verdict buttons into FeatureNavBar for code review (depends: T010)
  - **Why**: R7, R8 — Verdict buttons must appear in FeatureNavBar second row, not floating in ReviewPage header
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`, `apps/ui/src/components/shared/ReviewVerdict.tsx`
  - **Done when**: Approve/Request Changes buttons appear in nav-row-2 right side via FeatureHeaderContext, open thread count badge shows on Approve button, old header verdict buttons removed from ReviewPage JSX, ReviewVerdict component verified to work with FeatureHeaderContext injection

- [ ] T012: Apply Notion dark to ReviewPage overall layout and background (depends: T009, T011)
  - **Why**: R1, R2 — Page background, status bar, and any remaining terminal-luxe references must be migrated
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: Page background uses canvas, all text uses ink tokens, DM Sans applied to non-code text, no terminal-luxe class references remain in ReviewPage except inside diff code area

### Phase 5: Task View — Core Layout

- [ ] T013: Create TaskRow component (depends: T003, T004)
  - **Why**: R11, R12 — Individual task items need status icons, tags, and expandable details
  - **Files**: `apps/ui/src/components/tasks/TaskRow.tsx`
  - **Done when**: Renders task with status icon (done=checkmark/emerald, in-progress=play/blue with pulse, pending=circle/ghost, skipped=dash/faint), task ID in JetBrains Mono, title in DM Sans, dependency/file/parallel tags, click expands to show Why/Files/Done-when details and DepChain. Receives sibling task list from parent PhaseSection so DepChain can show both predecessors and successors

- [ ] T014: Create PhaseSection component (depends: T013)
  - **Why**: R10 — Collapsible phase cards with progress bars contain TaskRow items
  - **Files**: `apps/ui/src/components/tasks/PhaseSection.tsx`
  - **Done when**: Renders phase name (Newsreader), mini progress bar (emerald fill), task count, chevron toggle for collapse/expand, contains TaskRow list

- [ ] T015: Create TaskTimeline component (depends: T014)
  - **Why**: R9, R10 — Main task view layout with progress header and phase sections
  - **Files**: `apps/ui/src/components/tasks/TaskTimeline.tsx`
  - **Done when**: Renders ProgressRing with feature title (derived from featureId by stripping date prefix, converting hyphens to spaces, title-casing)/subtitle/mode badge/stats row at top, followed by PhaseSection cards, scrollable content area with max-width 960px

- [ ] T016: Replace TaskBoard with TaskTimeline in TasksPage (depends: T015)
  - **Why**: R9 — TasksPage must use the new timeline layout
  - **Files**: `apps/ui/src/pages/TasksPage.tsx`
  - **Done when**: TasksPage renders TaskTimeline instead of TaskBoard, Notion dark background, data flows correctly from task parsing to timeline components

### Phase 6: Polish & Verification

- [ ] T017: Visual verification against HTML mockups (depends: T012, T016)
  - **Why**: AC9 — Must confirm implementation matches approved mockup designs
  - **Files**: None (verification only)
  - **Done when**: Screenshots of running app compared to mockups, any visual discrepancies fixed

- [ ] T018: End-to-end functionality check (depends: T017)
  - **Why**: AC7 — All existing review functionality must work after restyling
  - **Files**: None (verification only)
  - **Done when**: Compose new thread, reply to thread, resolve thread, change verdict, navigate between files, switch diff modes — all work correctly

- [ ] T019: Type-check and lint pass (depends: T018)
  - **Why**: AC8 — Type-check must pass before feature is complete. Depends on T018 so functionality bugs are fixed before final verification.
  - **Files**: None (verification only)
  - **Done when**: `pnpm type-check` and `pnpm lint` pass with zero errors

## Status Legend

- [ ] = Pending
- [->] = In Progress
- [x] = Done
- [~] = Skipped
- [P] = Parallelizable (no dependency between [P] siblings)
