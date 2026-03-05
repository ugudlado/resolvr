# Tasks: 2026-03-05-auto-resolve-daemon

## Development Mode: Non-TDD

### Phase 1: Resolver Daemon Module

- [ ] T001: Create resolver-daemon.ts with cold-start and resolve functions
  - **Why**: Must Have — cold-start Claude CLI session and resume for resolve requests
  - **Files**: `apps/ui/src/server/resolver-daemon.ts` (create)
  - **Done when**: Module exports `coldStart()`, `resolve()`, `getStatus()` functions; `coldStart` spawns `claude -p`, captures session ID from JSON output; `resolve` spawns `claude -p --resume` with session file path

- [ ] T002: Add serialization and queue logic to resolver daemon
  - **Why**: Must Have — prevent concurrent resolve runs
  - **Files**: `apps/ui/src/server/resolver-daemon.ts` (modify)
  - **Done when**: `isResolving` flag blocks concurrent calls; single-slot queue stores latest pending request; queued request executes after current completes

### Phase 2: Vite Server Integration

- [ ] T003: Import daemon and cold-start in configureServer (depends: T001)
  - **Why**: Must Have — start Claude session when dev server boots
  - **Files**: `apps/ui/vite.config.ts` (modify)
  - **Done when**: `configureServer` calls `coldStart()` after server is ready; non-blocking (doesn't delay server startup); logs success/failure

- [ ] T004: Detect verdict change and trigger resolve in session POST handlers (depends: T003)
  - **Why**: Must Have — auto-trigger resolution on "Request Changes"
  - **Files**: `apps/ui/vite.config.ts` (modify)
  - **Done when**: Code-session and spec-session POST handlers compare incoming verdict with previous; if changed to `changes_requested` and open threads exist, calls `resolve()`; sends `review:resolve-started` WebSocket event before resolve and `review:resolve-completed` after

### Phase 3: UI Status Feedback

- [ ] T005: Create useResolveStatus hook for WebSocket events (depends: T004) [P]
  - **Why**: Must Have — UI needs to know when resolving is in progress
  - **Files**: `apps/ui/src/hooks/useResolveStatus.ts` (create)
  - **Done when**: Hook listens for `review:resolve-started` and `review:resolve-completed` custom HMR events; exposes `{ isResolving, lastResult }` state

- [ ] T006: Add resolving status indicator to ReviewVerdict area (depends: T005)
  - **Why**: Must Have — show spinner during resolution, summary on completion
  - **Files**: `apps/ui/src/components/shared/ReviewVerdict.tsx` (modify)
  - **Done when**: Shows "Resolving N threads..." with spinner when `isResolving` is true; shows "N resolved, N need clarification" flash message on completion

## Status Legend

- [ ] = Pending
- [→] = In Progress
- [x] = Done
- [~] = Skipped
- [P] = Parallelizable (no dependency between [P] siblings)
