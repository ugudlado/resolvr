# 2026-03-02-redesign-review-spec-code-tool: Redesign Review Plugin as Worktree-Based Spec & Code Review Tool

## Overview

Redesign the local-review Claude Code plugin from a code-only review tool into a dual-mode **spec review + code review** platform for agentic code changes. The tool tracks feature specifications through their full lifecycle (draft → review → approved → implementing → done) and provides review capabilities specifically designed for AI-generated code.

**Two primary modes:**

- **Spec Review** (during `/specify`): Review design documents, architecture diagrams, requirements, and task breakdowns with inline annotations on rendered markdown
- **Code Review** (during `/implement`): Review code diffs with threaded comments, using `@git-diff-view/react` for rendering

**Three top-level views:**

- **Dashboard**: Lists all feature worktrees with status, progress, and quick actions
- **Spec Review**: Interactive markdown renderer with inline annotations, diagram viewing, and task tracking
- **Code Review**: Diff-based code review with threaded comments (enhanced version of current functionality)

## Development Mode

**Mode**: Non-TDD

## Requirements

### Must Have

- [ ] Dashboard showing all feature worktrees discovered via `git worktree list`
- [ ] Each feature shows a 3-phase pipeline (Spec → Plan → Code) with progress indicators
- [ ] Spec review mode with rendered markdown from `specs/active/spec.md`
- [ ] Inline annotations on rendered markdown paragraphs (Google Docs-style commenting)
- [ ] Annotation gutter showing thread counts per paragraph/section
- [ ] Mermaid diagram rendering inline within spec, with diagram-level commenting
- [ ] Before/after diagram comparison display
- [ ] Task progress tracking parsed from `specs/active/tasks.md`
- [ ] Tasks view as both a right-panel tab in spec review AND a dedicated full-width view
- [ ] Code review mode using `@git-diff-view/react` with comment widgets
- [ ] Separate session files for spec review (`-spec.json`) and code review (`-code.json`)
- [ ] Stage-aware `/resolve` command that handles spec threads (revise design) vs code threads (fix code)
- [ ] Real-time sync via WebSocket when session files change externally
- [ ] Spec-level and code-level review verdicts (approve / request changes)
- [ ] Per-feature navigation bar (Spec | Tasks | Code tabs) visible in all feature views
- [ ] Thread-level PATCH endpoints to avoid concurrent write races between UI and CLI agents

### Nice to Have

- [ ] Command palette (`⌘K`) for quick navigation between features and views
- [ ] Keyboard shortcuts for navigating threads and sections
- [ ] Outdated thread detection (anchor content drift) for spec annotations
- [ ] Collapsible completed features on dashboard
- [ ] Diagram fullscreen expand mode

## Architecture

### Selected Approach: Dual-Mode Single App

One React app with routing for three views, sharing a unified thread model and session persistence layer. Both spec and code review use the same `ReviewThread` type with polymorphic anchors.

**Why this approach**: The thread model, session persistence, and agent resolution are the core value — they should be shared, not duplicated. Both modes are views into the same feature worktree. A unified app keeps the experience cohesive and reduces code duplication.

### Data Model

#### SpecReviewSession (new)

```typescript
interface SpecReviewSession {
  featureId: string;
  worktreePath: string;
  specPath: string; // "specs/active/spec.md"
  status: "draft" | "review" | "approved" | "implementing";
  verdict: "approved" | "changes_requested" | null;
  threads: ReviewThread[];
  taskProgress: TaskProgress;
  metadata: { createdAt: string; updatedAt: string };
}

interface TaskProgress {
  total: number;
  completed: number;
  inProgress: number;
  phases: Phase[];
  overallProgress: number; // 0-100
}

interface Phase {
  name: string;
  tasks: Task[];
  progress: number; // 0-100
}

interface Task {
  id: string; // e.g., "T001"
  description: string;
  status: "pending" | "in_progress" | "done" | "skipped";
  dependencies: string[];
  parallelizable: boolean;
}
```

#### CodeReviewSession (evolved from current ReviewSession)

```typescript
interface CodeReviewSession {
  featureId: string;
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  status: "none" | "in-progress" | "review" | "approved";
  verdict: "approved" | "changes_requested" | null;
  threads: ReviewThread[];
  committedDiff?: string;
  uncommittedDiff?: string;
  allDiff?: string;
  metadata: { createdAt: string; updatedAt: string };
}
```

**Note**: The legacy `diff?: string` field from the old `ReviewSession` is dropped. `allDiff` serves the same purpose.

#### ReviewThread (shared, polymorphic anchor)

```typescript
interface ReviewThread {
  id: string;
  anchor: ThreadAnchor;
  status: "open" | "resolved" | "approved";
  messages: ReviewMessage[];
  lastUpdatedAt: string;
}

type ThreadAnchor =
  | { type: "paragraph"; hash: string; path: string; preview: string }
  | { type: "heading"; hash: string; path: string; preview: string }
  | { type: "diagram"; hash: string; path: string; preview: string }
  | { type: "list-item"; hash: string; path: string; preview: string }
  | {
      type: "diff-line";
      hash: string;
      path: string;
      preview: string;
      line: number;
      lineEnd?: number;
      side: "old" | "new";
    };

interface ReviewMessage {
  id: string;
  authorType: "human" | "agent";
  author: string;
  text: string;
  createdAt: string;
}
```

#### Status State Machine

**SpecReviewSession.status** transitions:

```
draft → review (when /specify presents spec to user)
review → approved (when verdict is set to "approved")
review → draft (when verdict is "changes_requested" and spec is edited)
approved → implementing (when /implement begins)
```

**CodeReviewSession.status** transitions:

```
none → in-progress (when /implement creates the session)
in-progress → review (when implementation is complete and review begins)
review → approved (when verdict is set to "approved")
review → in-progress (when verdict is "changes_requested")
```

The `verdict` field drives `status` transitions: setting `verdict = "approved"` automatically advances status. Setting `verdict = "changes_requested"` moves status back to the editable state. The UI's `ReviewVerdict` component handles this coupling.

#### Session File Storage

```
.review/sessions/
├── {featureId}-spec.json      # SpecReviewSession
├── {featureId}-code.json      # CodeReviewSession
└── ...
```

### Component Architecture

```
App (React Router)
├── Dashboard (/)
│   └── FeatureCard
│       ├── PipelineProgress (spec/plan/code status bars)
│       └── QuickActions (Spec/Code/Tasks links)
│
├── FeatureLayout (/features/:id) — shared layout for all feature views
│   ├── FeatureNavBar (top — [Spec] [Tasks] [Code] tabs + feature title + back)
│   │
│   ├── SpecReview (/features/:id/spec)
│   │   ├── SpecOutline (left — markdown heading nav with thread indicators)
│   │   ├── SpecRenderer (center — two-column flex: content + gutter)
│   │   │   ├── ContentColumn
│   │   │   │   ├── AnnotatableParagraph (registers offsetTop via ref)
│   │   │   │   ├── MermaidDiagram
│   │   │   │   │   └── DiagramToolbar (expand/re-render/copy)
│   │   │   │   └── ComposeBox (inline comment creation)
│   │   │   └── AnnotationGutter (continuous rail, renders ¶ at measured y-offsets)
│   │   └── RightPanel (right — tabbed)
│   │       ├── ThreadList (annotation threads)
│   │       └── TaskTracker (compact tasks.md view)
│   │
│   ├── TasksView (/features/:id/tasks)
│   │   └── Full-width task board with phases, progress bars, dependencies
│   │
│   └── CodeReview (/features/:id/code)
│       ├── FileSidebar (left — file tree + thread overview)
│       ├── DiffView (center — @git-diff-view/react)
│       │   └── ThreadWidget (comment widget per line, range highlight via CSS)
│       └── ThreadPanel (right — thread list)
│
├── NotFound (/*) — fallback route, redirects to dashboard
│
└── Shared Components
    ├── ThreadCard (renders thread + replies, polymorphic anchor display)
    ├── ReviewVerdict (approve / request changes button pair)
    ├── ComposeBox (shared — accepts either spec anchor or diff line props)
    └── Hooks
        ├── useSpecSession (load/save spec sessions)
        ├── useCodeSession (load/save code sessions, evolved useReviewSession)
        ├── useTaskProgress (parse tasks.md, shared between TaskTracker + TasksView)
        └── useRealtimeSync (singleton WebSocket watcher, dispatches by filename suffix)
```

**In-feature navigation**: `FeatureNavBar` is a persistent top bar visible in all three feature views. It shows the feature title, [Spec] [Tasks] [Code] tab buttons (active tab highlighted), and a back arrow to the dashboard. This eliminates the need to return to the dashboard to switch modes.

**Routing fallback**: `<Route path="*">` catches unknown URLs and redirects to `/`. The old root URL (`/`) becomes the dashboard. The current single-page `ReviewPage` is accessible at `/features/:id/code` after refactoring.

**ThreadCard rewrite note**: The shared `ThreadCard` is a new component, not a refactor of the existing one. It renders different header content based on `anchor.type` — section path for spec anchors, file path + line range for diff anchors. The existing `threadRangeLabel()` utility is replaced by a polymorphic `anchorLabel(anchor: ThreadAnchor): string` helper.

**ComposeBox rewrite note**: The shared `ComposeBox` accepts a polymorphic `target` prop — either `{ type: "spec"; anchor: AnchorInfo }` or `{ type: "code"; selection: DiffSelection }`. The rendering is identical (textarea + submit), but the thread creation logic differs.

**FullFileView**: The current `FullFileView` component is deprecated. `@git-diff-view/react` supports full-file rendering natively — use its unified mode with all lines as context to achieve the same effect.

**`@git-diff-view/react` multi-line selection**: The library's widget system anchors to a single line. For multi-line comment ranges, the widget renders at `lineEnd` and the range (`line` to `lineEnd`) is highlighted via CSS (`background: #f0883e15`). The `ThreadAnchor` stores both `line` and `lineEnd` for display purposes.

### API Endpoints

**New endpoints:**

| Endpoint                                                 | Method | Purpose                                                                      |
| -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `/local-api/worktrees`                                   | GET    | List worktrees via `git worktree list`, check for `specs/active/`            |
| `/local-api/features`                                    | GET    | List features with combined spec + code status                               |
| `/local-api/features/:id/spec`                           | GET    | Load spec markdown content                                                   |
| `/local-api/features/:id/spec-session`                   | GET    | Load spec review session                                                     |
| `/local-api/features/:id/spec-session`                   | POST   | Save spec review session                                                     |
| `/local-api/features/:id/code-session`                   | GET    | Load code review session                                                     |
| `/local-api/features/:id/code-session`                   | POST   | Save code review session                                                     |
| `/local-api/features/:id/tasks`                          | GET    | Parse tasks.md into TaskProgress                                             |
| `/local-api/features/:id/diagrams`                       | GET    | List diagram files                                                           |
| `/local-api/features/:id/diagrams/:name`                 | GET    | Get mermaid source (returns `{ content: string }`)                           |
| `/local-api/features/:id/spec-session/threads/:threadId` | PATCH  | Update single thread (status, append message) — avoids concurrent write race |
| `/local-api/features/:id/code-session/threads/:threadId` | PATCH  | Update single thread (status, append message) — avoids concurrent write race |
| `/local-api/features/:id/spec-session`                   | DELETE | Reset spec review session                                                    |
| `/local-api/features/:id/code-session`                   | DELETE | Reset code review session                                                    |

**Concurrent write safety**: The PATCH thread endpoints read the session file, mutate only the target thread, and write back atomically. This prevents the race condition where the UI auto-saves the full session while the `/resolve` agent is updating a thread. The UI uses full POST for bulk operations (initial save, verdict changes) and PATCH for individual thread mutations.

**WebSocket event routing**: The `useRealtimeSync` hook is a singleton that watches `.review/sessions/` and dispatches events based on filename suffix. Events for `*-spec.json` files are routed to `useSpecSession`; events for `*-code.json` files are routed to `useCodeSession`. Each session hook registers a callback with `useRealtimeSync` rather than registering its own HMR listener.

**Retained endpoints** (for code review compatibility):
`/local-api/context`, `/local-api/diff`, `/local-api/commits`, `/local-api/commit-diff`, `/local-api/file`

**Migration from old sessions**: Old session files (named `{source}-vs-{target}.json`) are ignored by the new `/features` endpoint, which only loads files matching `{featureId}-spec.json` or `{featureId}-code.json` patterns. Old sessions remain accessible via the legacy `/local-api/sessions` endpoint for backwards compatibility. No migration script needed — old and new formats coexist in `.review/sessions/`.

### New Dependencies

| Library                         | Purpose                                                 | Replaces                    |
| ------------------------------- | ------------------------------------------------------- | --------------------------- |
| `@git-diff-view/react`          | Diff rendering with built-in comment widget system      | Custom DiffTable (~500 LOC) |
| `mermaid`                       | Client-side Mermaid diagram rendering                   | External diagram tools      |
| `react-router-dom`              | Client-side routing for dashboard/spec/code/tasks views | Single-page layout          |
| `react-markdown` + `remark-gfm` | Already in deps — spec markdown rendering               | —                           |

### Files to Create/Modify

**New files:**

- `src/apps/ui/src/pages/Dashboard.tsx` — feature list dashboard
- `src/apps/ui/src/pages/SpecReviewPage.tsx` — spec review view
- `src/apps/ui/src/pages/TasksPage.tsx` — dedicated tasks view
- `src/apps/ui/src/components/spec/SpecRenderer.tsx` — interactive markdown renderer
- `src/apps/ui/src/components/spec/AnnotatableParagraph.tsx` — commentable paragraph block
- `src/apps/ui/src/components/spec/AnnotationGutter.tsx` — thread markers in gutter
- `src/apps/ui/src/components/spec/MermaidDiagram.tsx` — mermaid rendering + commenting
- `src/apps/ui/src/components/spec/SpecOutline.tsx` — heading-based navigation
- `src/apps/ui/src/components/spec/DiagramToolbar.tsx` — diagram actions
- `src/apps/ui/src/components/tasks/TaskTracker.tsx` — compact task list (right panel)
- `src/apps/ui/src/components/tasks/TaskBoard.tsx` — full-width task view
- `src/apps/ui/src/components/tasks/PhaseCard.tsx` — phase progress display
- `src/apps/ui/src/components/shared/ThreadCard.tsx` — unified thread card
- `src/apps/ui/src/components/shared/ReviewVerdict.tsx` — approve/request changes
- `src/apps/ui/src/components/shared/ComposeBox.tsx` — shared comment composition
- `src/apps/ui/src/components/dashboard/FeatureCard.tsx` — feature summary card
- `src/apps/ui/src/components/dashboard/PipelineProgress.tsx` — status pipeline
- `src/apps/ui/src/hooks/useSpecSession.ts` — spec session management
- `src/apps/ui/src/hooks/useCodeSession.ts` — code session management (from useReviewSession)
- `src/apps/ui/src/hooks/useRealtimeSync.ts` — WebSocket file watcher
- `src/apps/ui/src/services/featureApi.ts` — new API client for feature endpoints
- `src/apps/ui/src/utils/tasksParser.ts` — parse tasks.md markdown into TaskProgress
- `src/apps/ui/src/utils/specAnchoring.ts` — paragraph hashing and anchor management
- `src/apps/ui/src/types/sessions.ts` — shared TypeScript types
- `commands/resolve.md` — updated stage-aware resolve command

**Modified files:**

- `src/apps/ui/src/App.tsx` — add React Router with routes
- `src/apps/ui/vite.config.ts` — add new API endpoints + SPA routing fallback
- `src/apps/ui/src/pages/ReviewPage.tsx` — refactor into CodeReviewPage (extract DiffView, FileSidebar, ThreadPanel as separate components; move branch selection + commit navigation to CodeReview; keep thread interaction patterns)
- `src/apps/ui/src/hooks/useReviewSession.ts` — evolve into useCodeSession
- `src/apps/ui/src/services/localReviewApi.ts` — add feature API methods
- `agents/review-resolver.md` — update for stage-aware resolution

**useReviewSession → useCodeSession migration checklist** (behaviors to preserve):

- `skipNextUpdate` ref for echo suppression when self-saving
- `cancelled` flag pattern in async effects to prevent stale state on rapid switches
- Debounced auto-save (200ms) on thread/verdict changes
- HMR listener registration (now via `useRealtimeSync` singleton instead of direct `import.meta.hot`)
- `localStorage` sync for draft text (adapt key scheme from branch-pair to featureId)

**tasks.md format contract** (referenced by `tasksParser.ts`):

```markdown
# Tasks: [FEATURE_ID]

## Development Mode: [TDD/Non-TDD]

### Phase 1: [Phase Name]

- [ ] T001: [Description]
- [ ] T002: [Description] (depends: T001)
- [x] T003: [Description] [P]
- [→] T004: [Description]
- [~] T005: [Description]
```

- Phase headers: `### Phase N: Name`
- Task IDs: `T` followed by 3+ digits at start of checkbox line
- Status: `[ ]` pending, `[→]` in progress, `[x]` done, `[~]` skipped
- Dependencies: `(depends: T001, T002)` after description
- Parallelizable: `[P]` suffix

## UI Design

### Aesthetic: "Terminal Luxe"

- **Fonts**: JetBrains Mono (code/labels/badges) + Source Serif 4 (spec body — serif for careful reading)
- **Colors**: GitHub dark base (`#0d1117` / `#161b22` / `#21262d`) with status accents
  - Specifying: `#bc8cff` (purple)
  - Implementing: `#58a6ff` (blue)
  - Review: `#f0883e` (orange)
  - Done: `#3fb950` (green)
  - Annotation highlight: `#f0883e15` (subtle orange glow)
- **Layout**: 3-column (outline / content / threads-tasks) for review views, full-width cards for dashboard

### Spec Annotation Model

**Anchoring mechanism**: Uses a remark AST pre-pass approach. Before rendering, `specAnchoring.ts` walks the parsed markdown AST (via `unified` + `remark-parse`) to:

1. Assign each block node a stable `blockIndex` (sequential position in the document)
2. Compute a content hash (first 8 chars of SHA-256) for each block
3. Track the current heading context to build a section path (e.g., `Architecture.Components`)
4. Generate a preview (first 80 chars of text content)

The pre-pass produces an `AnchorMap: Map<blockIndex, AnchorInfo>` that is passed to `SpecRenderer`. Custom `react-markdown` component renderers (`components.p`, `components.h1`-`h6`, etc.) receive the corresponding anchor info via a React context keyed by block index.

**Drift handling**: When a thread's `anchor.hash` no longer matches any block in the current document:

1. Fallback to `anchor.path` (section path) + fuzzy text match against blocks in that section
2. If fallback finds a candidate (>60% text similarity), re-anchor with a "drifted" indicator
3. If no match, mark thread as "orphaned" — shown in thread panel with warning, not shown in gutter

**Edge case**: Paragraphs before the first heading get section path `"_preamble"`.

**Section path computation is a must-have** (not deferred) because it serves as the primary fallback anchor when content changes during review.

Each anchor stored in a thread:

```typescript
// For spec anchors (paragraph, heading, diagram, list-item types):
{
  type: "paragraph",
  hash: "a1b2c3d4",           // content hash for exact match
  path: "Architecture.Components", // section path for fallback matching
  preview: "The system uses a dual-mode..." // first 80 chars for display
  blockIndex: 12               // position in document for ordering
}
```

**Gutter positioning**: `SpecRenderer` uses a two-column flex layout. The left column (`ContentColumn`) renders annotatable blocks; the right column (`AnnotationGutter`) is a continuous rail. Each `AnnotatableParagraph` registers its measured `offsetTop` via a ref callback, and the gutter renders `¶` markers at those y-positions. This produces a continuous gutter rail rather than fragmented per-paragraph markers.

Annotated paragraphs receive a subtle orange left-border (`2px solid #f0883e`) and faint background wash (`#f0883e15`).

### Dashboard Feature Cards

Each card shows:

- Feature ID and title
- 3-phase pipeline (Spec → Plan → Code) with progress bars
- Thread counts (open/total) per phase
- Branch info and last updated timestamp
- Quick action buttons: [Spec] [Tasks] [Code]

## Alternatives Considered

### Approach: Separate Apps, Shared Backend

Two distinct React apps (spec-reviewer and code-reviewer) sharing common Vite middleware.

- **Pros**: Simpler individual apps, independent development/deployment
- **Cons**: Duplicated UI patterns (threads, navigation), two build configs, harder mode transitions
- **Why rejected**: Thread model, persistence, and agent resolution are core value that should be shared

### Approach: Progressive Enhancement

Keep existing code review app, bolt on spec review as a new tab.

- **Pros**: Lowest risk, incremental delivery
- **Cons**: Tech debt accumulation, inconsistent UX, harder to unify thread model
- **Why rejected**: The redesign scope is large enough that progressive enhancement would create more debt than a clean restructure

### Diff Library: Keep Custom DiffTable

Continue with the hand-rolled ~500-line DiffTable component.

- **Pros**: Full control, no dependency risk
- **Cons**: Missing syntax highlighting, no split view, manual widget system maintenance
- **Why rejected**: `@git-diff-view/react` provides built-in widget system for comments, AST-based syntax highlighting, and split/unified views — eliminating significant custom code

### Diff Library: Monaco DiffEditor

Use VS Code's editor component for diffs.

- **Pros**: Richest editing experience, built-in diff support
- **Cons**: Heavy bundle (~5MB), less customizable for review widgets, complex API
- **Why rejected**: Overkill for read-only review; `@git-diff-view/react` is purpose-built for review UIs

## Acceptance Criteria

- [ ] Dashboard loads and lists all feature worktrees with correct status
- [ ] Clicking a feature opens spec review with rendered markdown
- [ ] Users can add inline annotations on any paragraph by clicking
- [ ] Annotation gutter shows thread counts, clicking scrolls to thread
- [ ] Mermaid diagrams render inline and are commentable
- [ ] Tasks view shows parsed tasks.md with phase progress bars
- [ ] Code review mode uses @git-diff-view/react with comment widgets
- [ ] Separate session files persist spec and code reviews independently
- [ ] /resolve command detects session type and handles spec vs code accordingly
- [ ] Real-time sync works: external file changes appear in UI without refresh
- [ ] Review verdicts (approve/request changes) work for both spec and code

## Review Summary

**Review agents consulted**: `feature-dev:code-architect` (architecture review), `feature-dev:code-reviewer` (frontend/UI review)

### Critical Issues Found and Resolved

1. **Concurrent write race** — Full-session POST creates race between UI auto-save and CLI agent writes. **Resolution**: Added PATCH thread endpoints for atomic single-thread mutations.
2. **Anchor hash orphaning** — No defined behavior when spec edits invalidate content hashes. **Resolution**: Added 3-tier anchor resolution (exact hash → section path + fuzzy match → orphaned) and detailed `specAnchoring.ts` design.
3. **Session filename collision** — Old `{source}-vs-{target}.json` files could conflict with new `{featureId}-spec.json` pattern. **Resolution**: New endpoints filter by naming convention; old sessions coexist via legacy endpoint.
4. **Section-path anchoring mechanism unspecified** — How paragraphs get section paths during react-markdown rendering was unclear. **Resolution**: Added remark AST pre-pass approach with block indexing and heading context tracking.
5. **No in-feature navigation** — Switching between Spec/Tasks/Code required going back to dashboard. **Resolution**: Added `FeatureLayout` with persistent `FeatureNavBar` showing tab buttons.

### Suggestions for User Consideration

- **`@git-diff-view/react` widget API verification**: The library's widget system should be spike-tested before full implementation to confirm it supports arbitrary React components and multi-line range highlighting. Fallback: keep custom DiffTable with syntax highlighting only from the library.
- **Paragraph anchoring complexity**: The remark AST pre-pass + React context approach is the highest-complexity new component. Consider a spike task before full implementation.
- **Mermaid rendering in React**: Known gotcha with async `mermaid.render()` + React re-renders. Use `useEffect` + cleanup pattern carefully.
- **`react-router-dom` SPA fallback**: Vite config needs `historyApiFallback`-equivalent to handle client-side routes.
- **`/worktrees` vs `/features` overlap**: Consider dropping the raw `/worktrees` endpoint since `/features` provides enriched data. Kept for now as a lower-level debugging tool.

## Open Questions

- None — all critical issues resolved during review. Suggestions above are implementation considerations, not blockers.

---

## UI Overhaul (Phases 13–16)

**Added:** 2026-03-04
**Scope:** Design tokens, typography, accessibility, animations, keyboard UX

### Context

Phases 1–12 built core functionality. This overhaul focuses on visual polish, accessibility, and UX enhancements to transform the tool from functional-but-generic into a polished developer tool.

### Typography Evolution

The original spec defined "Terminal Luxe" with JetBrains Mono + Source Serif 4 + Inter. This evolves to **Geist + Geist Mono** (Vercel's typeface family) for a more cohesive developer tool identity. Source Serif 4 remains for spec body text. JetBrains Mono kept as mono fallback.

Packages: `@fontsource-variable/geist-sans`, `@fontsource-variable/geist-mono`

### Design Tokens

All hardcoded hex colors across 15+ component files will be extracted to CSS custom properties in `index.css`. This enables theming and maintainability.

```css
:root {
  /* Backgrounds */
  --bg-base: #0d1117;
  --bg-surface: #161b22;
  --bg-elevated: #21262d;
  --bg-overlay: #30363d;

  /* Borders */
  --border-default: #30363d;
  --border-muted: #21262d;

  /* Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;
  --text-muted: #484f58;

  /* Accents */
  --accent-blue: #1f6feb;
  --accent-blue-muted: rgba(31, 111, 235, 0.2);
  --accent-blue-text: #58a6ff;

  /* Diff, Status, Pipeline, Shadows, Transitions... */
}
```

Components use tokens via Tailwind arbitrary values: `bg-[var(--bg-base)]`, `text-[var(--text-primary)]`.

### Accessibility

- Global `focus-visible` ring: `outline: 2px solid var(--accent-blue)`
- ARIA labels on all icon-only buttons
- `aria-live="polite"` on thread status regions
- Keyboard hints in `title` attributes

### Loading States

Skeleton components with shimmer animation replacing "Loading..." text:

- `DiffSkeleton` — shimmer rows matching line number + code line layout
- `SidebarSkeleton` — shimmer file list items
- `ThreadSkeleton` — shimmer card matching ThreadCard proportions

### Micro-Interactions

CSS-only animations (no new dependencies):

| Element             | Animation                     | Duration |
| ------------------- | ----------------------------- | -------- |
| Thread card expand  | opacity + translateY          | 250ms    |
| Compose box reveal  | fadeSlideDown                 | 200ms    |
| Sidebar item hover  | translateX(2px)               | 150ms    |
| Status badge change | color transition              | 300ms    |
| List items load     | staggered fade-in (50ms/item) | 200ms    |

### Empty States

Shared `EmptyState` component with icon variants: check, filter, file, comment. Replaces all plain-text empty states with contextual icons + messages.

### Command Palette (⌘K)

Overlay modal with fuzzy search across files, threads, and actions. Keyboard navigation: ↑↓ + Enter + Esc.

### Thread UX

- `j`/`k` keyboard navigation between threads
- `?` shortcut help overlay
- Thread severity labels: `blocking`, `suggestion`, `nitpick` (color-coded)

### Implementation Plan

Full step-by-step plan at `docs/plans/2026-03-04-ui-overhaul-plan.md`. Tasks T061–T076 in `tasks.md`.
