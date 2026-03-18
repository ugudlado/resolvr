# Tasks: Multi-Repo Dashboard

**Feature ID**: 2026-03-16-multi-repo-dashboard
**Generated**: 2026-03-16

---

## [ ] Phase 1: Server-Side Repo Override

### [ ] T-1: Create repo validation middleware

**Why**: R1 and R5 require the server to accept and validate a `repo` query parameter. A centralized middleware avoids duplicating validation logic across all route files.

**Files**:

- `apps/server/src/middleware/repo.ts` (new)

**Verify**:

- Middleware exports a `repoMiddleware(defaultRepoRoot)` factory function.
- Passing no `?repo` param sets context repoRoot to defaultRepoRoot.
- Passing `?repo=/valid/git/repo` sets context repoRoot to that path.
- Passing `?repo=/nonexistent` returns 400 with error message.
- Passing `?repo=/tmp` (non-git dir) returns 400.
- Passing `?repo=/foo/../etc/passwd` returns 400 (path traversal).
- Passing `?repo=~/code/review` expands tilde correctly.

---

### [ ] T-2: Apply middleware and refactor routes to use context repoRoot

**Why**: R1 requires all API endpoints to respect the per-request repo override. Routes currently read repoRoot from their closure; they need to read it from Hono context instead.

**Files**:

- `apps/server/src/index.ts` (apply middleware before routes)
- `apps/server/src/routes/features.ts` (read from context)
- `apps/server/src/routes/context.ts` (read from context)
- `apps/server/src/routes/sessions.ts` (read from context)
- `apps/server/src/routes/spec.ts` (read from context)
- `apps/server/src/routes/tasks.ts` (read from context)

**Verify**:

- `curl http://localhost:37003/api/features` returns features for the default repo (backward compat).
- `curl http://localhost:37003/api/features?repo=/path/to/other/repo` returns features scoped to that repo.
- All other API endpoints (`/api/context`, sessions, spec, tasks) also respect the `?repo` param.
- Type-check passes: `pnpm type-check`.

---

## [ ] Phase 2: UI Repo Context

### [ ] T-3: Create useRepoContext hook and withRepo URL helper

**Why**: R2 requires the UI to read the repo param from the URL and inject it into API calls. A shared hook and helper function avoid spreading URL parsing logic across components.

**Files**:

- `apps/ui/src/hooks/useRepoContext.ts` (new)
- `apps/ui/src/services/featureApi.ts` (add repo param to fetch calls)
- `apps/ui/src/services/localReviewApi.ts` (add repo param to fetch calls)

**Verify**:

- `useRepoContext()` returns `{ repo, repoName }` from URL search params.
- `withRepo("/api/features", "/Users/me/proj")` returns `"/api/features?repo=%2FUsers%2Fme%2Fproj"`.
- `withRepo("/api/features", null)` returns `"/api/features"` (no change).
- API clients pass repo through to server.
- Type-check passes: `pnpm type-check`.

---

### [ ] T-4: Wire repo context into Dashboard and feature pages

**Why**: R2 and R4 require the dashboard to display repo-scoped features and show the repo name. R2 also requires the repo param to persist across navigation.

**Files**:

- `apps/ui/src/pages/Dashboard.tsx` (use repo context, display repo name in header)
- `apps/ui/src/App.tsx` (preserve search params on navigation)
- Navigation components that use `Link` or `useNavigate` (preserve `?repo`)

**Verify**:

- Opening `http://localhost:37003?repo=/path/to/repo` shows features for that repo.
- Dashboard header displays the repo basename (e.g., "myproject").
- Opening `http://localhost:37003` shows default repo features with default repo name.
- Clicking a feature and navigating back preserves the `?repo` param in the URL.
- Lint passes: `pnpm lint`.

---

## [ ] Phase 3: Open Command Integration

### [ ] T-5: Update open command to pass repo context

**Why**: R3 requires the open command to detect the current working directory and include it in the URL, so the dashboard automatically shows features for the active project.

**Files**:

- `commands/open.md` (add repo=$PWD to URL construction)

**Verify**:

- The open command's generated URL includes `repo=<cwd>` as a query parameter.
- Existing `--worktree` and `--source` params continue to work alongside `repo`.
- Opening the generated URL in a browser shows the correct repo's features.

---

## [ ] Phase 4: Build and Smoke Test

### [ ] T-6: Rebuild server bundle and verify end-to-end

**Why**: The server runs from `apps/server/dist/index.js` in production (plugin mode). The bundle must be rebuilt to include the new middleware, and the full flow must be smoke-tested.

**Files**:

- `apps/server/dist/index.js` (rebuild via `pnpm -C apps/server build`)
- `apps/ui/dist/` (rebuild via `pnpm -C apps/ui build`)

**Verify**:

- `pnpm -C apps/server build` succeeds without errors.
- `pnpm -C apps/ui build` succeeds without errors.
- `pnpm type-check` passes.
- `pnpm lint` passes.
- Start server with `node apps/server/dist/index.js` and verify:
  - `GET /api/features` returns default repo features.
  - `GET /api/features?repo=<valid-repo>` returns that repo's features.
  - `GET /api/features?repo=/nonexistent` returns 400.
  - Dashboard at `http://localhost:37003` loads and shows features.
  - Dashboard at `http://localhost:37003?repo=<valid-repo>` shows that repo's features with repo name in header.
