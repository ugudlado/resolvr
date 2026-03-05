# Tasks: 2026-03-05-dashboard-revamp

## Development Mode: Non-TDD

### Phase 1: API Enhancement

- [ ] T001: Add task progress parsing to features endpoint [P]
  - **Why**: Must Have — task progress data needed for card display
  - **Files**: `apps/ui/vite.config.ts`
  - **Done when**: `GET /features` returns `taskProgress: { done: number, total: number }` per feature by parsing `tasks.md` checkbox counts

- [ ] T002: Add open thread count to features endpoint [P]
  - **Why**: Must Have — thread count needed for card metrics row
  - **Files**: `apps/ui/vite.config.ts`
  - **Done when**: `GET /features` returns `openThreads: number` per feature by scanning spec-session and code-session threads

- [ ] T003: Add last activity timestamp to features endpoint [P]
  - **Why**: Must Have — timestamps needed for card display and sorting
  - **Files**: `apps/ui/vite.config.ts`
  - **Done when**: `GET /features` returns `lastActivity: string` (ISO) per feature from most recent file mtime

- [ ] T004: Add files changed count to features endpoint [P]
  - **Why**: Must Have — file count shown in card metrics
  - **Files**: `apps/ui/vite.config.ts`
  - **Done when**: `GET /features` returns `filesChanged: number` per feature from code session diff

- [ ] T005: Extend FeatureInfo type with new fields (depends: T001, T002, T003, T004)
  - **Why**: Must Have — TypeScript types must match enhanced API response
  - **Files**: `apps/ui/src/services/featureApi.ts`, `apps/ui/src/types/sessions.ts`
  - **Done when**: `FeatureInfo` type includes `taskProgress`, `openThreads`, `lastActivity`, `filesChanged` fields

### Phase 2: Utility & Subcomponents

- [ ] T006: Create relative time formatter utility (depends: T005)
  - **Why**: Must Have — "2d ago", "just now" display format
  - **Files**: `apps/ui/src/utils/timeFormat.ts`
  - **Done when**: `relativeTime(isoString)` returns human-readable relative time strings

- [ ] T007: Create PipelineDots component (depends: T005) [P]
  - **Why**: Must Have — replaces wide pipeline bar with compact dots
  - **Files**: `apps/ui/src/components/dashboard/PipelineDots.tsx`
  - **Done when**: Renders 6 dots with filled/current/empty states, ring on current dot in status color, stage label

- [ ] T008: Create SkeletonCard component (depends: T005) [P]
  - **Why**: Must Have — loading placeholder matching card layout
  - **Files**: `apps/ui/src/components/dashboard/SkeletonCard.tsx`
  - **Done when**: Renders card-shaped skeleton with shimmer animation matching enhanced card proportions

- [ ] T009: Create EmptyState component (depends: T005) [P]
  - **Why**: Must Have — onboarding experience for first-time users
  - **Files**: `apps/ui/src/components/dashboard/EmptyState.tsx`
  - **Done when**: Centered layout with document icon, "No features yet" heading, explanation text, `/specify` command hint

### Phase 3: Enhanced Card & Dashboard

- [ ] T010: Rewrite FeatureCard with enhanced layout (depends: T006, T007)
  - **Why**: Must Have — core card redesign with all new metadata
  - **Files**: `apps/ui/src/components/dashboard/FeatureCard.tsx`
  - **Done when**: Card shows: title + timestamp, status badge + branch, task progress bar with count, metrics row (threads + files + pipeline dots), action links, hover accent line

- [ ] T011: Enhance Dashboard with sort, skeleton, empty state, search count (depends: T008, T009, T010)
  - **Why**: Must Have — dashboard-level features tying everything together
  - **Files**: `apps/ui/src/pages/Dashboard.tsx`
  - **Done when**: Sort dropdown works (activity/status/name), skeleton shows during loading, empty state shows when no features, search shows "N of M features" count, search highlights matched text

- [ ] T012: Delete old PipelineProgress component (depends: T010)
  - **Why**: Cleanup — replaced by PipelineDots
  - **Files**: `apps/ui/src/components/dashboard/PipelineProgress.tsx`
  - **Done when**: Old file deleted, no remaining imports

### Phase 4: Polish & Verification

- [ ] T013: Visual verification across all states (depends: T011, T012)
  - **Why**: Acceptance Criteria — verify all 5 states render correctly
  - **Files**: None (browser testing)
  - **Done when**: Screenshots confirm: active dashboard, empty state, loading skeleton, search filtering with count, error banner all render correctly with proper contrast

- [ ] T014: Type check and lint (depends: T013)
  - **Why**: verify-before-done rule — must pass before claiming complete
  - **Files**: None (CLI commands)
  - **Done when**: `pnpm type-check` and `pnpm lint` pass with zero errors

## Status Legend

- [ ] = Pending
- [→] = In Progress
- [x] = Done
- [~] = Skipped
- [P] = Parallelizable (no dependency between [P] siblings)
