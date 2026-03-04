# Tasks: 2026-03-02-redesign-review-spec-code-tool

## Development Mode: Non-TDD

### Phase 1: Foundation — Types, API, and Routing

- [x] T001: Define shared TypeScript types in `src/apps/ui/src/types/sessions.ts` (SpecReviewSession, CodeReviewSession, ReviewThread, ThreadAnchor, TaskProgress, ReviewMessage)
- [x] T002: Add `react-router-dom` to dependencies and set up routing in `App.tsx` with FeatureLayout wrapper, NotFound fallback, and SPA routing fallback in `vite.config.ts` (depends: T001)
- [x] T003: Implement worktree discovery API endpoint `GET /local-api/worktrees` using `git worktree list` (depends: T001)
- [x] T004: Implement feature listing API endpoint `GET /local-api/features` with spec + code status aggregation (depends: T003)
- [x] T005: Implement spec-related API endpoints: `GET /features/:id/spec`, `GET/POST/DELETE /features/:id/spec-session`, `PATCH /features/:id/spec-session/threads/:threadId` (depends: T001)
- [x] T006: Implement code session API endpoints: `GET/POST/DELETE /features/:id/code-session`, `PATCH /features/:id/code-session/threads/:threadId` (depends: T001)
- [x] T007: Implement tasks and diagrams API endpoints: `GET /features/:id/tasks`, `GET /features/:id/diagrams`, `GET /features/:id/diagrams/:name` (depends: T001)
- [x] T008: Create `featureApi.ts` client with typed methods for all new endpoints (depends: T005, T006, T007)
- [x] T009: Implement `tasksParser.ts` utility to parse tasks.md markdown into TaskProgress structure (depends: T001)

### Phase 2: Shared Components and Hooks

- [x] T010: Create `useRealtimeSync` singleton hook — WebSocket watcher that dispatches by filename suffix to registered callbacks (depends: T001)
- [x] T011: Create `useSpecSession` hook — load/save spec sessions with auto-save, echo suppression, and realtime sync integration (depends: T005, T008, T010)
- [x] T012: Create `useCodeSession` hook — evolve from `useReviewSession.ts` with new types, PATCH thread endpoint, and realtime sync integration (depends: T006, T008, T010)
- [x] T013: Create `useTaskProgress` hook — fetches and parses tasks.md, shared between TaskTracker and TasksView (depends: T007, T008, T009)
- [x] T014: Create shared `ThreadCard` component — polymorphic anchor display with `anchorLabel()` helper, reply composer, status buttons (depends: T001)
- [x] T015: Create shared `ReviewVerdict` component — approve/request changes buttons with status state machine coupling (depends: T001)
- [x] T016: Create shared `ComposeBox` component — accepts polymorphic target (spec anchor or diff selection), textarea + submit (depends: T001)
- [x] T017: Create `FeatureNavBar` component — persistent [Spec] [Tasks] [Code] tabs + feature title + back to dashboard (depends: T002)

### Phase 3: Spec Review UI

- [x] T018: Implement `specAnchoring.ts` — remark AST pre-pass for block indexing, content hashing, section path computation, drift detection (depends: T001)
- [x] T019: Spike: verify `@git-diff-view/react` widget API supports React components and range highlighting (depends: none) [P]
- [x] T020: Install `mermaid` dependency and create `MermaidDiagram` component with dark theme config, useEffect render pattern, and `DiagramToolbar` (depends: T001) [P]
- [x] T021: Create `AnnotatableParagraph` component — wraps markdown blocks, registers offsetTop via ref callback, handles click-to-compose (depends: T016, T018)
- [x] T022: Create `AnnotationGutter` component — continuous rail column, renders ¶ markers at measured y-offsets from AnnotatableParagraph refs (depends: T021)
- [x] T023: Create `SpecRenderer` component — two-column flex layout (ContentColumn + AnnotationGutter), custom react-markdown renderers consuming AnchorMap context (depends: T020, T021, T022)
- [x] T024: Create `SpecOutline` component — heading nav generated from AnchorMap, thread indicators per section (depends: T018)
- [x] T025: Create `RightPanel` with Threads/Tasks tabs — ThreadList using spec session threads + TaskTracker using useTaskProgress (depends: T011, T013, T014)
- [x] T026: Create `SpecReviewPage` — assembles SpecOutline + SpecRenderer + RightPanel, integrates useSpecSession (depends: T023, T024, T025)

### Phase 4: Tasks View

- [x] T027: Create `PhaseCard` component — phase progress bar, task list with status icons and dependency labels (depends: T001)
- [x] T028: Create `TaskBoard` component — full-width task view with all PhaseCards and overall progress (depends: T013, T027)
- [x] T029: Create `TasksPage` — wraps TaskBoard with feature context, connected to useTaskProgress (depends: T017, T028)

### Phase 5: Code Review Migration

- [x] T030: Install `@git-diff-view/react` and create DiffView wrapper component with dark theme and widget system integration (depends: T019)
- [x] T031: Implement ThreadWidget for @git-diff-view — renders ComposeBox in widget slot, CSS range highlighting for multi-line comments (depends: T016, T030)
- [x] T032: Refactor ReviewPage.tsx into CodeReviewPage — extract FileSidebar, DiffView, ThreadPanel as separate components (depends: T012, T014, T030, T031)
- [x] T033: Deprecate FullFileView — replace with @git-diff-view/react unified mode with all-context rendering (depends: T030)

### Phase 6: Dashboard

- [x] T034: Create `PipelineProgress` component — 3-phase (Spec/Plan/Code) status bars with thread counts (depends: T001)
- [x] T035: Create `FeatureCard` component — feature summary with PipelineProgress, branch info, quick action buttons (depends: T034)
- [x] T036: Create `Dashboard` page — lists FeatureCards from /features API, collapsible completed section (depends: T004, T008, T035)

### Phase 7: CLI Integration

- [x] T037: Update `commands/resolve.md` — stage-aware resolution that checks session filename suffix, passes spec vs code context to agent (depends: T005, T006)
- [x] T038: Update `agents/review-resolver.md` — add spec resolution mode (revise spec sections, update diagrams) alongside existing code resolution mode (depends: T037)
- [x] T039: Update `commands/open.md` — open dashboard by default, accept optional `--spec` or `--code` flag to navigate directly to a feature's review mode (depends: T002)

### Phase 8: Polish and Integration

- [x] T040: Apply "Terminal Luxe" design system — JetBrains Mono + Source Serif 4 fonts, GitHub dark color palette, status accent colors across all components (depends: T026, T029, T032, T036)
- [x] T041: Wire up Vite SPA fallback for client-side routing — ensure `/features/*` paths are handled by React Router, not intercepted by middleware (depends: T002)
- [x] T042: End-to-end integration testing — create a test feature worktree with spec, tasks, and code changes; verify full flow through dashboard → spec review → tasks → code review → resolve (depends: T036, T037)

### Phase 9: Code Review UX — Bug Fixes and Enhancements

- [x] T043: Fix nested file path diff rendering — greedy regex `\S+` → `\S+?` in `hunksByFile` so paths like `commands/resolve.md` extract correctly instead of just `resolve.md` (depends: T032)
- [x] T044: Add text selection commenting — `DiffSelectionPopover` component that appears on text selection in diff, plus `SelectionComposePortal` that injects compose form via React portal after target diff row (depends: T031)
- [x] T045: Add multi-line selection support — extend `composingAt` state to track `startLineNumber`, forward through `SelectionComposePortal` → `ComposeWidget` to create range anchors (depends: T044)
- [x] T046: Add GitHub-style `+` button click+drag line range selection — `LineRangeSelector` component with mousedown/mousemove/mouseup on add-widget buttons, shift+click extension, CSS row highlighting (depends: T031)
- [x] T047: Simplify line range selection UX — remove intermediate "Lines X–Y / Comment" popover, open compose form directly on mouseup for both single-click and drag ranges (depends: T046)
- [x] T048: Make threads panel global across all files — rewrite `CodeThreadsPanel` to show all threads grouped by file path with sticky file headers, thread counts, and current-file highlighting (depends: T032)
- [x] T049: Add click-to-navigate from threads panel — clicking a thread in `CodeThreadsPanel` switches to the thread's file, scrolls to target line, and flashes a 2-second highlight on the row (depends: T048)

### Phase 10: Task Scope and UI Fixes

- [x] T050: Fix duplicated phase name prefix in TaskBoard
  - **Why**: Bug — PhaseCard prepends "Phase N:" but phase.name already contains it from markdown heading
  - **Files**: `src/apps/ui/src/components/tasks/PhaseCard.tsx`, `src/apps/ui/src/components/tasks/TaskBoard.tsx`
  - **Done when**: Phase headers show "Phase 1: Foundation..." not "Phase 1: Phase 1: Foundation..."

- [x] T051: Parse task description fields (Why/Files/Done when) in tasksParser
  - **Why**: Task scope needs to be visible — each task must tie back to spec requirements
  - **Files**: `src/apps/ui/src/utils/tasksParser.ts`, `src/apps/ui/src/types/sessions.ts`, `src/apps/ui/vite.config.ts` (inline parser)
  - **Done when**: Parser captures indented `**Why**`, `**Files**`, `**Done when**` lines into Task type; backward compatible with single-line tasks

- [x] T052: Show task descriptions in expandable TaskRow UI
  - **Why**: Task scope needs to be visible in Tasks view for reviewers and implementers
  - **Files**: `src/apps/ui/src/components/tasks/PhaseCard.tsx`
  - **Done when**: Clicking a task row expands to show Why/Files/Done when fields; collapsed by default

### Phase 11: Spec Comment UX Parity with Code View

- [x] T053: Add `data-compose-button` attribute to AnnotatableParagraph
  - **Why**: BlockRangeSelector needs to identify compose buttons via data attribute
  - **Files**: `src/apps/ui/src/components/spec/AnnotatableParagraph.tsx`
  - **Done when**: "+" buttons have `data-compose-button={blockIndex}` attribute

- [x] T054: Create BlockRangeSelector behavioral component
  - **Why**: Spec view needs click+drag block range selection like code view's LineRangeSelector
  - **Files**: `src/apps/ui/src/components/spec/BlockRangeSelector.tsx` (new)
  - **Done when**: Click+drag on "+" buttons selects range, Shift+click extends, Escape clears

- [x] T055: Integrate BlockRangeSelector into SpecRenderer (depends: T054)
  - **Why**: Wire up the behavioral component to fire compose with range anchors
  - **Files**: `src/apps/ui/src/components/spec/SpecRenderer.tsx`
  - **Done when**: BlockRangeSelector rendered alongside SelectionPopover, fires onCompose with blockIndexEnd

- [x] T056: Track active section from scroll position
  - **Why**: Section filtering needs to know which spec section is currently visible
  - **Files**: `src/apps/ui/src/pages/SpecReviewPage.tsx`
  - **Done when**: `activeSectionPath` state updates on scroll, uses h2+ headings only

- [x] T057: Enhance RightPanel with section filtering (depends: T056)
  - **Why**: Spec threads panel needs "Current section" filter like code view's "Current file" filter
  - **Files**: `src/apps/ui/src/components/spec/RightPanel.tsx`
  - **Done when**: All/Section toggle filters threads, grouped-by-section headers in "all" mode

- [x] T058: Implement thread click navigation with flash highlight
  - **Why**: Clicking a thread in the panel should scroll to and highlight the anchored block
  - **Files**: `src/apps/ui/src/pages/SpecReviewPage.tsx`
  - **Done when**: Click thread card → smooth scroll to block → 1.5s blue flash animation

### Phase 12: UX Parity — Code View Thread Panel

- [x] T059: Add Open/Resolved tabs to code view ThreadPanel + move verdict to bottom
  - **Why**: Spec view's RightPanel has Open/Resolved status tabs; code view ThreadPanel lacks them
  - **Files**: `src/apps/ui/src/pages/CodeReviewPage.tsx`
  - **Done when**: Open/Resolved tabs filter threads by status, verdict bar at bottom, file scope filter still works

- [x] T060: Extract shared ThreadStatusTabs component and useThreadPartition hook
  - **Why**: Open/Resolved tab header and thread filtering logic were triplicated across ThreadPanel, RightPanel, and CodeThreadsPanel
  - **Files**: `src/apps/ui/src/components/shared/ThreadStatusTabs.tsx` (new), `src/apps/ui/src/hooks/useThreadPartition.ts` (new), `src/apps/ui/src/pages/CodeReviewPage.tsx`, `src/apps/ui/src/components/spec/RightPanel.tsx`, `src/apps/ui/src/components/review/CodeThreadsPanel.tsx`
  - **Done when**: All three panels use shared component and hook, no duplicated tab JSX or filter logic

### Phase 13: UI Overhaul — Design Tokens + Typography

- [x] T061: Define CSS design tokens in index.css
  - **Why**: All colors are hardcoded hex strings across 15+ files; CSS variables enable theming and maintainability
  - **Files**: `src/apps/ui/src/index.css`
  - **Done when**: All background, border, text, accent, diff, status, shadow, and transition tokens defined as CSS custom properties

- [x] T062: Install Geist fonts and configure Tailwind
  - **Why**: Replace generic system fonts with distinctive Geist Sans + Geist Mono for developer tool identity
  - **Files**: `src/apps/ui/package.json`, `src/apps/ui/src/index.css`, `src/apps/ui/tailwind.config.js`
  - **Done when**: Geist fonts installed via @fontsource-variable, imported in CSS, Tailwind config extended with font families

- [x] T063: [P] Replace hardcoded hex in CodeReviewPage and its components
  - **Why**: Migrate CodeReviewPage from raw hex to CSS variable tokens (depends: T061)
  - **Files**: `src/apps/ui/src/pages/CodeReviewPage.tsx`
  - **Done when**: No raw hex color values remain in file, all use var(--token) or Tailwind token classes

- [x] T064: [P] Replace hardcoded hex in SpecReviewPage and its components
  - **Why**: Migrate SpecReviewPage from raw hex to CSS variable tokens (depends: T061)
  - **Files**: `src/apps/ui/src/pages/SpecReviewPage.tsx`, `src/apps/ui/src/components/spec/*.tsx`
  - **Done when**: No raw hex color values remain in spec view files

- [x] T065: [P] Replace hardcoded hex in ReviewPage (legacy) and shared components
  - **Why**: Migrate legacy ReviewPage + shared components (ThreadCard, ComposeBox, etc.) from raw hex to CSS variable tokens (depends: T061)
  - **Files**: `src/apps/ui/src/pages/ReviewPage.tsx`, `src/apps/ui/src/components/review/*.tsx`, `src/apps/ui/src/components/shared/*.tsx`, `src/apps/ui/src/components/sidebar/*.tsx`, `src/apps/ui/src/components/diff/*.tsx`
  - **Done when**: No raw hex color values remain in these files

- [x] T066: [P] Replace hardcoded hex in Dashboard and remaining pages
  - **Why**: Migrate Dashboard, NotFound, TasksPage from raw hex to CSS variable tokens (depends: T061)
  - **Files**: `src/apps/ui/src/pages/Dashboard.tsx`, `src/apps/ui/src/pages/NotFound.tsx`, `src/apps/ui/src/pages/TasksPage.tsx`
  - **Done when**: No raw hex color values remain in page files

### Phase 14: UI Overhaul — Accessibility + Loading States

- [x] T067: Add global focus-visible styles and ARIA labels
  - **Why**: No focus rings or ARIA labels exist; keyboard users and screen readers get minimal feedback
  - **Files**: `src/apps/ui/src/index.css`, all components with icon-only buttons
  - **Done when**: Focus-visible ring on all interactive elements, ARIA labels on icon-only buttons, aria-live on status regions

- [x] T068: Create skeleton loading components
  - **Why**: Current loading is plain "Loading..." text; skeleton screens improve perceived performance
  - **Files**: New `src/apps/ui/src/components/shared/DiffSkeleton.tsx`, `SidebarSkeleton.tsx`, `ThreadSkeleton.tsx`
  - **Done when**: Three skeleton components with shimmer animation, matching proportions of real components

- [x] T069: Wire skeleton components into pages
  - **Why**: Replace "Loading..." text with skeleton components (depends: T068)
  - **Files**: `src/apps/ui/src/pages/CodeReviewPage.tsx`, `SpecReviewPage.tsx`, `ReviewPage.tsx`
  - **Done when**: Loading states show skeletons instead of text, smooth transition to real content

### Phase 15: UI Overhaul — Micro-Interactions + Empty States

- [x] T070: Add CSS transition animations to interactive elements
  - **Why**: Thread cards, status badges, tabs, and compose box appear/disappear instantly; transitions add polish
  - **Files**: `src/apps/ui/src/index.css`, `ThreadCard.tsx`, `ComposeBox.tsx`, `ThreadStatusTabs.tsx`
  - **Done when**: Thread expand/collapse animated, status badge color transitions, tab underline slides, compose box slides down

- [x] T071: Add staggered fade-in animations for lists
  - **Why**: File lists and thread lists pop in all at once; staggered reveals feel more crafted
  - **Files**: `src/apps/ui/src/index.css`, sidebar and thread list components
  - **Done when**: File items and thread items fade in with 50ms stagger delay

- [x] T072: Create EmptyState shared component and replace plain text empty states
  - **Why**: Empty states are plain gray text; contextual icons + messages improve UX
  - **Files**: New `src/apps/ui/src/components/shared/EmptyState.tsx`, all components with empty states
  - **Done when**: EmptyState component with icon variants, all empty text replaced with component

### Phase 16: UI Overhaul — Keyboard Palette + Thread UX

- [x] T073: Build CommandPalette component (⌘K)
  - **Why**: Keyboard shortcuts exist but are undiscoverable; command palette is the modern standard
  - **Files**: New `src/apps/ui/src/components/shared/CommandPalette.tsx`
  - **Done when**: ⌘K opens overlay, fuzzy search filters files/threads/actions, ↑↓+Enter navigation, Esc closes

- [x] T074: Wire CommandPalette into review pages
  - **Why**: Command palette needs to be connected to page state for file navigation, thread jumping (depends: T073)
  - **Files**: `src/apps/ui/src/pages/CodeReviewPage.tsx`, `SpecReviewPage.tsx`
  - **Done when**: ⌘K works on both pages, actions execute correctly

- [x] T075: Add j/k thread navigation and keyboard shortcut help overlay
  - **Why**: Power users need keyboard-first thread navigation
  - **Files**: `src/apps/ui/src/pages/CodeReviewPage.tsx`, `SpecReviewPage.tsx`, new `ShortcutHelp.tsx`
  - **Done when**: j/k navigates threads with visual focus, ? opens shortcut help overlay

- [x] T076: Add thread severity labels (blocking/suggestion/nitpick)
  - **Why**: Not all review comments are equal; severity helps reviewers prioritize
  - **Files**: `src/apps/ui/src/components/shared/ThreadCard.tsx`, `ComposeBox.tsx`
  - **Done when**: Severity selector in compose, color-coded label in thread header, filterable in overview

### Phase 17: UI Refinements — Status, Buttons, Formatting, Naming

- [x] T077: Update ReviewVerdict button colors — always green (approve) and blue (request changes), remove hover color transitions
  - **Why**: Buttons should be visually distinct at rest, not just on hover
  - **Files**: `src/apps/ui/src/components/shared/ReviewVerdict.tsx`
  - **Done when**: Approve always green, Request Changes always blue, no hover-based color changes, both spec and code views consistent

- [x] T078: Fix plain code block formatting in SpecRenderer — broken tree character alignment
  - **Why**: ASCII diagrams (status state machine, file tree, component architecture) in spec have misaligned `├└│` characters
  - **Files**: `src/apps/ui/src/components/spec/SpecRenderer.tsx`, possibly `src/apps/ui/src/index.css`
  - **Done when**: Plain code blocks render with monospace font, `white-space: pre`, proper alignment preserved

- [x] T079: Create APP_NAME constant and rename dashboard header from "Feature Dashboard" to "Local Review"
  - **Why**: Dashboard label should match plugin name, stored in one place for easy renaming
  - **Files**: New `src/apps/ui/src/config/app.ts`, `src/apps/ui/src/pages/Dashboard.tsx`, `src/apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: Single `APP_NAME` constant used in all title locations, dashboard shows "Local Review"

- [x] T080: Define unified `FeatureStatus` type replacing `SpecReviewStatus` + `CodeReviewStatus` + `FeatureLifecycleStatus`
  - **Why**: Three separate status systems create confusion; single linear status (new → design → design_review → code → code_review → complete) is clearer
  - **Files**: `src/apps/ui/src/types/sessions.ts`, `src/apps/ui/src/utils/featureStatus.ts`
  - **Done when**: `FeatureStatus` type defined with 6 values, `STATUS_MAP` updated, old types removed

- [x] T081: Update `FeatureInfo` API type and server endpoint to use single `FeatureStatus` (depends: T080)
  - **Why**: API must return single status instead of separate specStatus/codeStatus
  - **Files**: `src/apps/ui/src/services/featureApi.ts`, `src/apps/ui/vite.config.ts` (middleware)
  - **Done when**: `FeatureInfo.status` is single `FeatureStatus`, server derives it from session files

- [x] T082: Update FeatureCard and PipelineProgress to use single status badge (depends: T081)
  - **Why**: Dashboard cards should show one status instead of 3-segment pipeline
  - **Files**: `src/apps/ui/src/components/dashboard/FeatureCard.tsx`, `src/apps/ui/src/components/dashboard/PipelineProgress.tsx`
  - **Done when**: Single status badge on card, pipeline shows linear progress through 6 stages

- [x] T083: Update FeatureNavBar and router to auto-navigate by feature status (depends: T081)
  - **Why**: Clicking a feature should open the relevant view (spec for design phases, code for code phases)
  - **Files**: `src/apps/ui/src/components/FeatureNavBar.tsx`, `src/apps/ui/src/App.tsx`
  - **Done when**: Default route redirects based on status, tabs still allow manual switching

- [x] T084: Update ReviewVerdict verdict handling to drive FeatureStatus transitions (depends: T080, T081)
  - **Why**: Verdict changes (approve/request changes) must update the single FeatureStatus
  - **Files**: `src/apps/ui/src/hooks/useSpecSession.ts`, `src/apps/ui/src/hooks/useCodeSession.ts`, `src/apps/ui/src/components/shared/ReviewVerdict.tsx`
  - **Done when**: Approve on spec → status becomes `code`, changes requested on spec → status becomes `design`, approve on code → `complete`, changes requested on code → `code`

### Phase 18: UX Quick Fixes

- [x] T085: Make FeatureCard clickable to navigate by status
  - **Why**: Whole card should be a click target, not just individual action links
  - **Files**: `src/apps/ui/src/components/dashboard/FeatureCard.tsx`
  - **Done when**: Clicking card navigates to `/features/{id}` which auto-redirects by status

- [x] T086: Remove review notes textarea from code view sidebar
  - **Why**: User considers it unnecessary clutter
  - **Files**: `src/apps/ui/src/components/sidebar/FileSidebar.tsx`
  - **Done when**: No "Review Notes" section visible in code review sidebar

- [x] T087: Remove docs folder, keep specs as single source of truth
  - **Why**: docs/plans/ duplicates specs structure; specs/active/ is the convention
  - **Files**: Project structure only
  - **Done when**: docs/plans/ removed, plan files not needed (gitignored anyway)

### Phase 19: Migrate Diagrams from Mermaid to Draw.io

- [x] T088: Convert existing .mmd diagram files to .drawio XML format
  - **Why**: Mermaid rendering has been fragile (dark theme corruption, concurrent render bugs, tiny scaling); draw.io provides WYSIWYG editing and native dark mode
  - **Files**: `specs/active/diagrams/architecture.drawio`, `data-flow.drawio`, `before.drawio`, `after.drawio`
  - **Done when**: All 4 diagrams converted to draw.io XML, old .mmd files deleted

- [x] T089: Create DrawioDiagram component replacing MermaidDiagram
  - **Why**: New rendering approach uses draw.io viewer iframe instead of inline mermaid.js
  - **Files**: `src/apps/ui/src/components/spec/DrawioDiagram.tsx` (new), `src/apps/ui/src/components/spec/MermaidDiagram.tsx` (deleted)
  - **Done when**: DrawioDiagram renders via `viewer.diagrams.net` iframe with base64-encoded XML, loading state, fullscreen mode, annotation click handler

- [x] T090: Update DiagramToolbar for draw.io editor integration
  - **Why**: "Open in Mermaid Live Editor" must become "Open in draw.io Editor"
  - **Files**: `src/apps/ui/src/components/spec/DiagramToolbar.tsx`
  - **Done when**: Opens `app.diagrams.net/#R{base64_xml}`, mermaid URL builder removed

- [x] T091: Update DiagramsSection, SpecRenderer, and API endpoints
  - **Why**: All integration points must switch from .mmd to .drawio
  - **Files**: `src/apps/ui/src/components/spec/DiagramsSection.tsx`, `src/apps/ui/src/components/spec/SpecRenderer.tsx`, `src/apps/ui/vite.config.ts`
  - **Done when**: DiagramsSection imports DrawioDiagram, SpecRenderer mermaid code block handler removed, API filters .drawio files

- [x] T092: Remove mermaid and react-zoom-pan-pinch dependencies
  - **Why**: No longer needed after migration to draw.io viewer
  - **Files**: `src/apps/ui/package.json`
  - **Done when**: Both packages removed, pnpm install clean, build passes, no mermaid imports in src/

## Status Legend

- [ ] = Pending
- [→] = In Progress
- [x] = Done
- [~] = Skipped
- [P] = Parallelizable (no dependency between [P] siblings)
