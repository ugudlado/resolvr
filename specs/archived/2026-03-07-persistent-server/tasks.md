# Tasks: 2026-03-07-persistent-server

## Development Mode: Non-TDD

### Phase 1: Package Scaffold

- [x] T001: Create apps/server package scaffold
  - **Why**: Must Have — establish the new server package before any logic can be moved
  - **Files**: `apps/server/package.json`, `apps/server/tsconfig.json`, `pnpm-workspace.yaml`
  - **Done when**: `pnpm -C apps/server install` succeeds; package resolves as `@local-review/server`; dependencies include hono, @hono/node-server, chokidar

### Phase 2: Git Layer [P]

- [x] T002: Implement git.ts — consolidated git state + cache [P]
  - **Why**: Must Have — replaces N+1 subprocess pattern; all routes read from this cache
  - **Files**: `apps/server/src/git.ts`
  - **Done when**: `refreshGitState()` runs 3 parallel git calls (worktree list, for-each-ref, branch --no-merged main); `getGitState()` returns cached result; detached HEAD worktrees are skipped; remote branches are excluded

- [x] T003: Implement watcher.ts — git cache invalidation + session WS push [P]
  - **Why**: Must Have — cache must stay fresh; session WebSocket push must be preserved
  - **Files**: `apps/server/src/watcher.ts`
  - **Done when**: chokidar watches `.git/HEAD`, `.git/refs/heads/`, `.git/worktrees/`; on change debounces 300ms then calls `refreshGitState()`; separately watches `.review/sessions/*.json` and emits `review:session-updated` WS event

### Phase 3: Routes (all depend on T002 + T003) [P]

- [x] T004: Implement routes/features.ts [P]
  - **Why**: Must Have — primary dashboard endpoint; reads from git cache + session files
  - **Files**: `apps/server/src/routes/features.ts`
  - **Done when**: `GET /api/features` returns same shape as current vite.config.ts handler; worktree features + archived features + branch-only features all present; open thread counts and task progress correct; response uses cached git state (no git subprocesses at request time)

- [x] T005: Implement routes/sessions.ts [P]
  - **Why**: Must Have — session CRUD is the core persistence layer for review threads
  - **Files**: `apps/server/src/routes/sessions.ts`
  - **Done when**: All session routes work: GET/POST code-session, GET/POST spec-session, PATCH thread status, GET features list from sessions; auto-resolve trigger on verdict change preserved

- [x] T006: Implement routes/context.ts [P]
  - **Why**: Must Have — powers the code review page branch/diff selectors
  - **Files**: `apps/server/src/routes/context.ts`
  - **Done when**: `GET /api/context` returns worktrees, branches, currentBranch, defaultTargetBranch from cache; `GET /api/diff` runs git diff on-demand; `GET /api/commits` and `GET /api/commit-diff` work; `GET /api/worktrees` returns cached worktree list

- [x] T007: Implement routes/spec.ts and routes/tasks.ts [P]
  - **Why**: Must Have — spec/task read+write; diagrams served
  - **Files**: `apps/server/src/routes/spec.ts`, `apps/server/src/routes/tasks.ts`
  - **Done when**: GET/PUT `/api/features/:id/spec` reads/writes spec.md using cached worktree path lookup; GET/PUT `/api/features/:id/tasks` reads/writes tasks.md; GET `/api/features/:id/diagrams/:name` serves .drawio files; GET `/api/file` serves arbitrary files within home dir

### Phase 4: Server Entry + WebSocket (depends on T004–T007)

- [x] T008: Implement index.ts — server entry point with WebSocket support
  - **Why**: Must Have — ties all routes together; startup sequence; WS push
  - **Files**: `apps/server/src/index.ts`
  - **Done when**: Hono app mounts all routes; startup runs `refreshGitState()` then watchers then `serve()`; WebSocket upgrade handled for session push events; serves `apps/ui/dist/` as static in production; SPA fallback (non-API GET → index.html)

### Phase 5: UI WebSocket Migration + Proxy (depends on T008)

- [x] T009: Migrate UI hooks from import.meta.hot to native WebSocket
  - **Why**: Must Have — current hooks use Vite HMR protocol (`import.meta.hot.on`); standalone server uses a real WS endpoint
  - **Files**: `apps/ui/src/hooks/useRealtimeSync.ts`, `apps/ui/src/hooks/useReviewSession.ts`, `apps/ui/src/hooks/useResolveStatus.ts`
  - **Done when**: All 3 hooks connect to `ws://localhost:37003/ws` (or same-origin `/ws`) instead of `import.meta.hot`; events `review:session-updated`, `review:resolve-started`, `review:resolve-completed`, `review:resolve-failed` all work; connection auto-reconnects on drop

- [x] T010: Gut vite.config.ts to proxy-only
  - **Why**: Must Have — removes all business logic from build tool config
  - **Files**: `apps/ui/vite.config.ts`
  - **Done when**: vite.config.ts is ~20 lines; React plugin + `/api` proxy to port 37003 + `/ws` proxy to ws://localhost:37003; all route handler code removed; TypeScript type-check passes

- [x] T011: Add root dev script and update SessionStart hook
  - **Why**: Must Have — developer workflow and plugin boot must use new server
  - **Files**: `package.json` (root), `hooks/session-start.sh`
  - **Done when**: `pnpm dev` from root starts both `apps/server dev` and `apps/ui dev` concurrently; SessionStart hook starts `apps/server` (not just Vite); `pnpm -C apps/server start` serves pre-built UI correctly

### Phase 6: Verification

- [x] T012: End-to-end verification
  - **Why**: Acceptance criteria — confirm no regressions before marking complete
  - **Files**: none (verification only)
  - **Done when**: Dashboard loads in <50ms (cache hit); all review page features work (diff, threads, session save/load, verdict); git cache invalidates when branch created; `pnpm type-check` passes with no errors

### Phase 7: Post-Launch Fixes

- [x] T013: Standalone ReviewPage should auto-detect featureId from branch
- [x] T014: Auto-reset verdict when all threads resolved (non-DEV_WORKFLOW mode)
  - **Why**: Without Approve button, "Changes Requested" badge is sticky forever after threads resolve
  - **Files**: `apps/ui/src/hooks/useReviewSession.ts`
  - **Done when**: When DEV_WORKFLOW is false and all threads are resolved, verdict auto-resets to null
  - **Why**: Bug — root `/` renders ReviewPage without featureId, so sessions (threads/verdict) never load
  - **Files**: `apps/ui/src/App.tsx`
  - **Done when**: Standalone ReviewPage at `/` detects current branch, looks up matching feature, passes featureId to ReviewPage; threads and verdict visible without manually navigating to `/features/:id`

## Status Legend

Symbols: [ ] pending · \[→\] in-progress · [x] done · [~] skipped · [P] parallelizable
