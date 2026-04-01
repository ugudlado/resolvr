# Tasks: Thread Triage & Smart Routing

## Development Mode: Non-TDD

## Phase 1: Type System & Constants

- [x] T-1 Add THREAD_SEVERITY to types/constants.ts and update ThreadSeverity type
  - **Why**: R1 — severity type update
  - **Files**: `apps/ui/src/types/constants.ts`
  - **Done when**: `THREAD_SEVERITY` const object exported with `Critical`, `Improvement`, `Style`, `Question` values; `ThreadSeverity` type derived from it

- [x] T-2 Update types/sessions.ts to import ThreadSeverity from constants and make severity required on ReviewThread
  - **Why**: R1, R6 — type consistency
  - **Files**: `apps/ui/src/types/sessions.ts`
  - **Done when**: `ThreadSeverity` imported from constants (not defined inline), `ReviewThread.severity` uses the new type and is required (not optional), old inline `ThreadSeverity` type removed

- [x] T-3 Add severity field to legacy ReviewThread in localReviewApi.ts
  - **Why**: R6 — session persistence compatibility
  - **Files**: `apps/ui/src/services/localReviewApi.ts`
  - **Done when**: `severity?: string` field added to the legacy `ReviewThread` type

- [x] T-4 Review checkpoint (phase gate)

## Phase 2: UI Components

- [x] T-5 Update ComposeBox severity selector with new values and colors (depends: T-1)
  - **Why**: R3 — compose box severity selector
  - **Files**: `apps/ui/src/components/shared/ComposeBox.tsx`
  - **Done when**: `SEVERITIES` array uses `THREAD_SEVERITY` values, styles updated for 4 severity levels, default is `improvement`

- [x] T-6 Update ThreadCard SeverityBadge with new values and colors (depends: T-1)
  - **Why**: R2 — severity badge display
  - **Files**: `apps/ui/src/components/shared/ThreadCard.tsx`
  - **Done when**: `severityConfig` has entries for all 4 new severity values with appropriate colors

- [x] T-7 Add SeveritySelector to ThreadCard expanded view for manual override (depends: T-6)
  - **Why**: R7 — manual override
  - **Files**: `apps/ui/src/components/shared/ThreadCard.tsx`
  - **Done when**: Expanded ThreadCard shows severity dropdown, `onSeverityChange` callback prop added to ThreadCardProps, selector dispatches change

- [x] T-8 Wire severity through ReviewPage thread creation (depends: T-2)
  - **Why**: R6 — severity in session persistence
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: `handleComposeSubmit` accepts and stores severity on new threads, defaults to `improvement`

- [x] T-9 Wire severity through SpecReviewPage thread creation (depends: T-2)
  - **Why**: R6 — severity in session persistence
  - **Files**: `apps/ui/src/pages/SpecReviewPage.tsx`
  - **Done when**: Thread creation handler passes severity from ComposeBox to addThread

- [x] T-10 Wire onSeverityChange in ReviewPage and SpecReviewPage (depends: T-7)
  - **Why**: R7 — manual override persistence
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`, `apps/ui/src/pages/SpecReviewPage.tsx`
  - **Done when**: Severity changes from ThreadCard update the thread in state and persist to session

- [x] T-11 Review checkpoint (phase gate)

## Phase 3: Server & Resolver

- [x] T-12 Add severity to PatchPayload in server sessions route (depends: T-1)
  - **Why**: R6 — server persistence
  - **Files**: `apps/server/src/routes/sessions.ts`
  - **Done when**: `PatchPayload` includes optional `severity` field, PATCH handler applies it to thread

- [x] T-13 Update pickModel() with new severity-based routing (depends: T-1)
  - **Why**: R4 — model routing
  - **Files**: `apps/server/src/resolver-daemon.ts`
  - **Done when**: `pickModel()` returns Sonnet when any thread has `critical` severity, Haiku otherwise

- [x] T-14 Add priority sorting and question filtering to resolver (depends: T-13)
  - **Why**: R5 — priority ordering
  - **Files**: `apps/server/src/resolver-daemon.ts`
  - **Done when**: Open threads sorted by severity priority before resolution, `question` threads filtered out, empty batch returns early

- [x] T-15 Update buildResolvePrompt to include priority context (depends: T-14)
  - **Why**: R5 — resolver awareness of priority
  - **Files**: `apps/server/src/resolver-daemon.ts`
  - **Done when**: Resolve prompt mentions severity ordering and instructs agent to handle threads in priority order

- [x] T-16 Review checkpoint (phase gate)

## Phase 4: Build & Verify

- [x] T-17 Run type-check and lint, fix any issues (depends: T-15)
  - **Why**: Quality gate
  - **Done when**: `pnpm type-check` and `pnpm lint` pass with no errors

- [x] T-18 Rebuild server dist bundle (depends: T-17)
  - **Why**: Server bundle must include resolver changes
  - **Done when**: `pnpm -C apps/server build` succeeds, dist/index.js updated

- [x] T-19 Review checkpoint (phase gate)

<!-- Status markers: [ ] pending, [->] in-progress, [x] done -->
<!-- [P] = parallelizable, (depends: T-xxx) = dependency -->
