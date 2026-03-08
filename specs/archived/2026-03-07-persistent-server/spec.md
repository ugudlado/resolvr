# 2026-03-07-persistent-server: Persistent Hono Server + Git Consolidation

## Overview

Extract all API and git logic from `apps/ui/vite.config.ts` into a persistent standalone Node server (`apps/server/`). Replace the current pattern of spawning multiple git subprocesses per dashboard request with a single cached git state (3 parallel git calls at startup, invalidated by `.git/` file watching). Mirrors the Lens plugin architecture exactly.

## Development Mode

**Mode**: Non-TDD (infrastructure refactor, no business logic changes)

## Requirements

### Must Have

- [ ] `apps/server/` Hono server serves API on port 37003 and static `apps/ui/dist/` in production
- [ ] All git state computed once at startup via 3 parallel calls: `git worktree list --porcelain`, `git for-each-ref refs/heads`, `git branch --no-merged main`
- [ ] Git cache invalidated by watching `.git/HEAD`, `.git/refs/heads/`, `.git/worktrees/`
- [ ] All API routes from `vite.config.ts` migrated to `apps/server/src/routes/`
- [ ] WebSocket push for session file changes (`.review/sessions/*.json`) preserved
- [ ] `apps/ui/vite.config.ts` shrunk to ~20 lines: React plugin + `/api` proxy to port 37003
- [ ] Dev workflow: `pnpm -C apps/server dev` + `pnpm -C apps/ui dev` run concurrently
- [ ] Plugin SessionStart hook updated to start the server process
- [ ] Detached HEAD worktrees ignored (no fallback `getCurrentBranch` subprocess)
- [ ] Remote branches ignored (only local branches)

### Nice to Have

- [ ] `features-updated` WebSocket event pushed when git cache is invalidated (dashboard auto-refreshes)

## Architecture

### Package Structure

```
apps/server/
  package.json        — name: @local-review/server, scripts: dev/build/start
  tsconfig.json       — ESM, NodeNext modules
  src/
    index.ts          — Hono app, startup sequence
    git.ts            — refreshGitState(), getGitState(), cache + watcher setup
    watcher.ts        — session file watcher, WebSocket push
    routes/
      features.ts     — GET /api/features
      sessions.ts     — session CRUD (save, load, patch thread)
      context.ts      — GET /api/context (diff, branches for review page)
      spec.ts         — GET/PUT /api/features/:id/spec
      tasks.ts        — GET/PUT /api/features/:id/tasks

apps/ui/
  vite.config.ts      — React plugin + server.proxy: { '/api': 'http://localhost:37003' }
  (all other source unchanged)
```

### Git State Shape

```ts
type GitState = {
  worktrees: Array<{ path: string; branch: string }>; // local worktrees, detached ignored
  localBranches: string[]; // all local branch names
  unmergedBranches: string[]; // branches not merged to main
  computedAt: number; // Date.now()
};
```

`refreshGitState()` runs these 3 calls in `Promise.all`:

1. `git worktree list --porcelain` — paths + branches (skip if branch line missing = detached)
2. `git for-each-ref --format=%(refname:short) refs/heads` — local branch names
3. `git branch --no-merged main` — unmerged local branches

### Cache Invalidation

`chokidar` watches (same library Lens uses):

- `.git/HEAD`
- `.git/refs/heads/` (recursive)
- `.git/worktrees/` (recursive)

On any change: debounce 300ms → `refreshGitState()` → optionally push `features-updated` WS event.

### API Route Mapping (unchanged URLs)

| Route                                           | Handler                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `GET /api/features`                             | reads from git cache + session files      |
| `GET /api/context`                              | reads from git cache; runs diff on-demand |
| `GET /api/worktrees`                            | reads from git cache                      |
| `GET /api/branches`                             | reads from git cache                      |
| `GET/PUT /api/features/:id/spec`                | file read/write                           |
| `GET/PUT /api/features/:id/tasks`               | file read/write                           |
| `GET/POST/PATCH /api/features/:id/code-session` | session CRUD                              |
| `GET/POST/PATCH /api/features/:id/spec-session` | session CRUD                              |
| WebSocket                                       | session file watcher push                 |

### Startup Sequence

```
1. refreshGitState()          — warm cache before first request
2. startGitWatcher()          — watch .git/ for invalidation
3. startSessionWatcher()      — watch .review/sessions/ for WS push
4. serve(app, { port: 37003 })
```

### Dev Workflow

```bash
# Terminal 1 — API server with hot reload
pnpm -C apps/server dev   # tsx watch src/index.ts

# Terminal 2 — UI with HMR
pnpm -C apps/ui dev       # Vite, proxies /api → :37003
```

Or via concurrently: `pnpm dev` from repo root starts both.

### Plugin Hook Update

`hooks/load-feature-context.sh` (SessionStart): start `apps/server` instead of (or in addition to) Vite.

### Files to Create

- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/server/src/index.ts`
- `apps/server/src/git.ts`
- `apps/server/src/watcher.ts`
- `apps/server/src/routes/features.ts`
- `apps/server/src/routes/sessions.ts`
- `apps/server/src/routes/context.ts`
- `apps/server/src/routes/spec.ts`
- `apps/server/src/routes/tasks.ts`

### Files to Modify

- `apps/ui/vite.config.ts` — gut to ~20 lines
- `pnpm-workspace.yaml` — add `apps/server`
- `hooks/load-feature-context.sh` — start server process
- `package.json` (root) — add `dev` script using concurrently

## Alternatives Considered

### A) Short TTL Cache in vite.config.ts

- **Pros**: Minimal change, no new package
- **Cons**: Still on-demand per request, Vite middleware restarts wipe cache, doesn't solve architectural debt
- **Why rejected**: Doesn't address root cause — server logic in a build tool config

### B) Keep Vite Middleware, Add Persistent Cache Layer

- **Pros**: Less migration work
- **Cons**: vite.config.ts stays bloated at 1600+ lines, cache lives in Vite process memory which can restart
- **Why rejected**: Doesn't improve maintainability or match Lens pattern

## Acceptance Criteria

- [ ] `GET /api/features` responds in <50ms on second request (cache hit)
- [ ] Dashboard loads with no perceptible delay after server is warm
- [ ] All existing API routes work identically (same URLs, same response shapes)
- [ ] Session save/load/patch/WebSocket push all work
- [ ] `apps/ui/vite.config.ts` contains no business logic (route handlers, git calls)
- [ ] Running `pnpm -C apps/server dev` starts server that serves features correctly
- [ ] Git cache invalidates when a new branch is created or worktree added
