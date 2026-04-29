# Design: Multi-Repo Dashboard

**Feature ID**: 2026-03-16-multi-repo-dashboard
**Date**: 2026-03-16

## Approach: Per-Request Repo Override via Hono Middleware

### Decision

Use a Hono middleware that extracts the `repo` query parameter, validates it, resolves it to an absolute path, and stores it in the Hono context (`c.set("repoRoot", resolvedPath)`). Each route handler reads `c.get("repoRoot")` instead of using the closure-captured `repoRoot`.

### Alternatives Considered

1. **Per-route parameter extraction** -- Each route handler independently reads `?repo` from the query string. Rejected: duplicates validation logic across 5+ route files, high risk of inconsistency.

2. **Multiple server instances** -- Launch a separate server per repo. Rejected: heavy resource usage, port management complexity, doesn't match the "single plugin server" model.

3. **Server startup flag** -- Pass repo root as CLI argument to the server. Rejected: requires server restart to switch repos, breaks the single-instance model.

### Selected: Middleware approach

A single middleware handles extraction, validation, and fallback. Route creators still receive a `defaultRepoRoot` for the fallback case, but handlers read the per-request value from context.

## Component Breakdown

### 1. Server Middleware: `repoMiddleware`

**File**: `apps/server/src/middleware/repo.ts` (new)

```
Request → extract ?repo param
        → if absent: use defaultRepoRoot
        → if present: expand ~ → resolve to absolute → validate
        → c.set("repoRoot", resolvedPath)
        → next()
```

Validation steps (in order):

1. Reject if path contains `..` segment (before any resolution).
2. Expand leading `~` to `os.homedir()`.
3. Resolve to absolute path via `path.resolve()`.
4. Check `fs.existsSync(resolved)`.
5. Check `fs.existsSync(path.join(resolved, ".git"))` OR that `resolved` itself is inside a `.git` worktree (check for `.git` file pointing to a worktree).
6. On any failure: return `c.json({ error: "..." }, 400)`.

**[ASSUMPTION]**: We check for both `.git/` directory and `.git` file to support worktrees, where `.git` is a file containing `gitdir: /path/to/main/.git/worktrees/name`.

### 2. Server Route Refactor

**Files**: All route files in `apps/server/src/routes/`

Current pattern:

```ts
export function createFeaturesRoute(repoRoot: string) {
  const app = new Hono();
  app.get("/", (c) => {
    /* uses repoRoot from closure */
  });
  return app;
}
```

New pattern:

```ts
export function createFeaturesRoute(defaultRepoRoot: string) {
  const app = new Hono();
  app.get("/", (c) => {
    const repoRoot = c.get("repoRoot") ?? defaultRepoRoot;
    /* uses repoRoot from context */
  });
  return app;
}
```

The middleware is applied at the top level in `index.ts` before route mounting, so `c.get("repoRoot")` is always available. Routes fall back to the default if somehow the middleware didn't run (defensive).

### 3. Server Index Changes

**File**: `apps/server/src/index.ts`

- Import and apply `repoMiddleware` before route registration.
- Pass `defaultRepoRoot` (the current hardcoded value) to the middleware factory.

```ts
import { repoMiddleware } from "./middleware/repo";

const defaultRepoRoot = path.resolve(__dirname, "../../..");
app.use("/api/*", repoMiddleware(defaultRepoRoot));
```

### 4. Git State Per-Request

**File**: `apps/server/src/git.ts`

`refreshGitState(repoRoot)` already accepts `repoRoot` as a parameter. No changes needed to its signature. Callers in route handlers will pass the per-request `repoRoot` from context instead of the closure value.

**[ASSUMPTION]**: `refreshGitState` is stateless per call (no module-level cache keyed to a single repo). If there is a module-level cache, it needs to be keyed by repo path.

### 5. UI: Repo Context via URL Search Params

**Files**: `apps/ui/src/hooks/useRepoContext.ts` (new), API service files

New hook: `useRepoContext()`

- Reads `repo` from `window.location.search` using `useSearchParams()` from React Router.
- Returns `{ repo: string | null, repoName: string | null }`.
- `repoName` is the basename of the repo path (for display in the header).

API service changes:

- Add a helper function `withRepo(url: string, repo: string | null): string` that appends `?repo=<value>` (or `&repo=<value>`) to API URLs when `repo` is non-null.
- Update `featureApi.ts` and `localReviewApi.ts` to accept an optional `repo` parameter and use `withRepo()`.

### 6. UI: Preserve Repo Param Across Navigation

**Files**: `apps/ui/src/App.tsx`, navigation components

When the `repo` search param is present, it must survive client-side route transitions (e.g., from `/` to `/features/:id/code`).

Approach: Create a thin wrapper around React Router's `Link` and `useNavigate` that preserves the `repo` search param. Alternatively, since `repo` is a search param on the top-level URL, and feature routes use path segments (`/features/:id/...`), the search params naturally persist if navigation uses `useNavigate` with `{ search: location.search }`.

**[ASSUMPTION]**: React Router's `Link` component does not automatically preserve search params. We need to explicitly carry them forward. A `useRepoLink()` hook or a wrapper component handles this.

### 7. UI: Dashboard Header

**File**: `apps/ui/src/pages/Dashboard.tsx` (or relevant header component)

- Read `repoName` from `useRepoContext()`.
- Display it in the dashboard header area (e.g., "Features -- myproject").
- When `repo` is null (default), fetch the default repo name from `GET /api/context` (which already returns repo info) or simply show "local-review" as fallback.

### 8. Open Command Changes

**File**: `commands/open.md`

Add `repo` param to the URL construction:

- Detect `$PWD` (current working directory of the Claude session).
- Append `repo=$PWD` to the URL query string.
- Result: `http://localhost:37003?repo=/Users/spidey/code/myproject&worktree=...&source=...`

### 9. No SessionStart Hook Changes

The hook starts the server once. Repo context is per-request, not per-server-instance. No changes needed.

## Data Flow

```
User invokes /local-review:open from ~/code/myproject
  → open command constructs URL with ?repo=/Users/spidey/code/myproject
  → browser opens http://localhost:37003?repo=/Users/spidey/code/myproject

Dashboard.tsx renders
  → useRepoContext() reads repo=/Users/spidey/code/myproject from URL
  → featureApi.fetchFeatures({ repo }) calls GET /api/features?repo=/Users/spidey/code/myproject

Server receives request
  → repoMiddleware extracts repo param, validates, sets c.repoRoot
  → createFeaturesRoute handler reads c.get("repoRoot")
  → Scans /Users/spidey/code/myproject for worktrees, openspec dirs, sessions
  → Returns features JSON

Dashboard renders features for myproject
  → Header shows "myproject"
  → Clicking a feature navigates to /features/:id/code?repo=/Users/spidey/code/myproject
```

## Error Handling

| Scenario                          | Behavior                                         |
| --------------------------------- | ------------------------------------------------ |
| `?repo` absent                    | Use default repoRoot, current behavior preserved |
| `?repo` is not a directory        | 400: "Path does not exist"                       |
| `?repo` is not a git repo         | 400: "Path is not a git repository"              |
| `?repo` contains `..`             | 400: "Path traversal not allowed"                |
| `?repo` valid but has no features | 200: empty features array (normal)               |

## Backward Compatibility

- No `repo` param = exact current behavior. The middleware falls through to the default.
- Existing open command URLs without `repo` continue to work.
- No database or persistent state changes.
