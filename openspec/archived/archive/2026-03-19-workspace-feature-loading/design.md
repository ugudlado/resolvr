# Design: Workspace-Based Feature Loading

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │  ~/.config/local-review/         │
                    │    workspaces.json               │
                    │  ┌───────────────────────────┐   │
                    │  │ lastActive: "/abs/path"   │   │
                    │  │ workspaces: [             │   │
                    │  │   {name, path, addedAt},  │   │
                    │  │   ...                     │   │
                    │  │ ]                         │   │
                    │  └───────────────────────────┘   │
                    └──────────┬──────────────────────┘
                               │ read/write (atomic)
                               ▼
┌──────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│ session-start│───▶│  workspaces.ts       │◀───│  repo middleware  │
│ hook         │    │  (registry module)   │    │  (fallback logic) │
│              │    │                      │    │                   │
│ git rev-parse│    │ • registerWorkspace()│    │ ?workspace= ──▶ resolve
│ --git-common │    │ • resolveWorkspace() │    │ ?repo= ──▶ use directly
│ -dir         │    │ • getDefaultRepo()   │    │ (none) ──▶ getDefaultRepo()
└──────────────┘    │ • setLastActive()    │    └──────────────────┘
                    └──────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  git.ts              │
                    │  (per-workspace cache)│
                    │                      │
                    │  Map<path, GitState> │
                    │  refreshGitState(p)  │
                    │  getGitState(p)      │
                    └──────────────────────┘
```

## Data Flow

### Server Startup (changed)

```
index.ts module load:
  1. repoRoot = path.resolve(__dirname, "../../..")     // unchanged — static fallback
  2. ensureRegistered(repoRoot)                          // NEW — register without touching lastActive
  3. defaultRepo = getDefaultRepo() || repoRoot          // NEW — read lastActive from registry
  4. refreshGitState(defaultRepo)                        // populate cache for default
  5. startWatcher(defaultRepo)                           // watch default repo
```

Key difference from current: `ensureRegistered()` is a new function that adds the workspace to the registry if absent but NEVER mutates `lastActive`. This prevents server restarts from overwriting the user's workspace preference.

### Workspace Registration (changed)

```
POST /api/workspaces/register { path: "/some/path" }
  │
  ├─ Is .git a file (worktree)?
  │    YES ──▶ git rev-parse --git-common-dir
  │           ──▶ resolve to main repo root
  │           ──▶ use resolved path
  │    NO  ──▶ use path as-is
  │
  ├─ registerWorkspace(resolvedPath)
  │    ├─ Deduplicate by resolved path
  │    ├─ Add { name, path, addedAt } if new
  │    └─ Set lastActive = resolvedPath      ◀── path-based, not name-based
  │
  └─ Return { added: boolean, workspace: { name, path } }
```

### Feature Request (changed fallback only)

```
GET /api/features
  │
  ├─ repo middleware:
  │    ├─ ?workspace=X  ──▶ resolveWorkspace(X) ──▶ c.set("repoRoot", resolved)
  │    ├─ ?repo=/path   ──▶ validate path        ──▶ c.set("repoRoot", path)
  │    └─ (no params)   ──▶ getDefaultRepo()     ──▶ c.set("repoRoot", default)
  │                          ↑ NEW: reads lastActive (path) from registry
  │                          Falls back to static repoRoot if registry empty
  │
  ├─ features route handler:
  │    ├─ getGitState(repoRoot) ──▶ per-workspace cache lookup
  │    │   └─ if miss: refreshGitState(repoRoot) ──▶ populate cache
  │    ├─ Pass 1-3: unchanged logic using cached git state
  │    └─ setLastActive(repoRoot) ──▶ update registry (path-based)
  │
  └─ Return { features: [...], repoName }
```

## File Changes

### 1. `apps/server/src/workspaces.ts` — Registry Module

**Changes:**

- Add `lastActive` field to the registry JSON schema — stored as **absolute path**, not name
- Add `getDefaultRepo(): string | null` — returns the `lastActive` path, validated for existence
- Add `setLastActive(repoPath: string): void` — updates `lastActive` in registry
- Add `ensureRegistered(repoPath: string): void` — registers if absent, does NOT touch `lastActive`
- Modify `registerWorkspace(inputPath)`:
  - Detect worktree (`.git` is a file) and resolve via `git rev-parse --git-common-dir`
  - Set `lastActive` to the resolved absolute path
  - Remove the `isRealRepo` check that silently rejects worktrees
- Add `addedAt` timestamp to workspace entries (for future sorting)
- **Atomic writes**: Replace `fs.writeFileSync` with write-to-temp-file + `fs.renameSync` pattern to prevent corruption during concurrent writes

**New registry schema:**

```json
{
  "lastActive": "/Users/spidey/code/review",
  "workspaces": [
    {
      "name": "review",
      "path": "/Users/spidey/code/review",
      "addedAt": "2026-03-19T10:00:00Z"
    },
    {
      "name": "lens",
      "path": "/Users/spidey/code/lens",
      "addedAt": "2026-03-18T15:00:00Z"
    }
  ]
}
```

Note: `lastActive` is a path, not a name. This avoids ambiguity when two repos share the same basename (e.g. `~/work/app` and `~/personal/app` both have name `"app"`).

**Migration:** The current schema is a flat array `[{name, path}]`. On first read, detect the old format (array at root) and auto-migrate to the new object format with `lastActive` set to the first entry's path. The migration is idempotent.

### 2. `apps/server/src/git.ts` — Per-Workspace Cache

**Changes:**

- Replace module-level `let cache: GitState` with `const cacheMap = new Map<string, GitState>()`
- `refreshGitState(repoPath)` stores result in `cacheMap.set(repoPath, state)`
- `getGitState(repoPath)` reads from `cacheMap.get(repoPath)` — returns `null` if cache miss
- Add `hasGitState(repoPath): boolean` for cache-miss detection
- Export `clearGitState(repoPath)` for cache invalidation (used by watcher)

### 3. `apps/server/src/middleware/repo.ts` — Default Fallback

**Changes:**

- Import `getDefaultRepo` from `workspaces.ts`
- Change the no-params fallback from the static `repoRoot` to `getDefaultRepo() ?? repoRoot`
- No changes to `?repo=` or `?workspace=` handling

### 4. `apps/server/src/index.ts` — Startup Sequence

**Changes:**

- Replace `registerWorkspace(repoRoot)` with `ensureRegistered(repoRoot)` — does NOT set `lastActive`
- After ensuring registration, call `getDefaultRepo()` to determine the effective default
- Pass the effective default (not static `repoRoot`) to `refreshGitState()` and `startWatcher()`

### 5. ALL git-state consumers — Repo-Aware Cache Access

**Files affected:**

- `apps/server/src/routes/features.ts`
- `apps/server/src/routes/context.ts`
- `apps/server/src/routes/spec.ts`
- `apps/server/src/utils.ts`
- Any other file that calls `getGitState()` or `refreshGitState()`

**Changes (uniform across all files):**

- Replace `getGitState()` (no-arg) calls with `getGitState(repoRoot)` where `repoRoot` comes from Hono context (`c.get("repoRoot")`)
- Replace `refreshGitState()` (no-arg or single-arg) calls to always pass the resolved repo path
- On cache miss, call `refreshGitState(repoRoot)` before proceeding
- Remove the `isOverride` distinction in `features.ts` — all repos use the same cache-lookup pattern
- In `features.ts` only: after serving features, call `setLastActive(repoRoot)` to track activity

### 6. `apps/server/src/watcher.ts` — Multi-Workspace Watch (R7, stretch)

**Changes:**

- Maintain a `Map<string, FSWatcher>` of watched repos → watcher instances
- `startWatcher(repoPath)` creates a watcher for a specific repo, keyed by path
- `stopWatcher(repoPath)` closes and removes the watcher for a specific repo
- On workspace registration, call `startWatcher(newRepoPath)` if not already watched
- On file change, use the watched path to determine which repo's cache to invalidate via `clearGitState(repoPath)` and broadcast workspace-scoped events

### 7. `hooks/session-start.sh` — Worktree Resolution

**Changes:**

- After `git rev-parse --show-toplevel`, add worktree detection and resolution:
  ```bash
  if [ -f "$REPO_ROOT/.git" ]; then
    # Worktree — resolve to main repo
    REPO_ROOT=$(git -C "$REPO_ROOT" rev-parse --git-common-dir | sed 's|/\.git$||')
  fi
  ```
- POST the resolved main repo path instead of the raw worktree path
- This is defense-in-depth — the server also resolves, but resolving client-side avoids unnecessary round-trips

## API Contract Changes

### `GET /api/workspaces` (unchanged response shape)

No changes. Returns the same workspace list.

### `POST /api/workspaces/register` (unchanged request, enhanced response)

**Request:** `{ "path": "/some/path" }` — unchanged, now accepts worktree paths

**Response:** `{ "added": boolean, "workspace": { "name": string, "path": string } }` — adds `workspace` field showing the resolved workspace (useful when input was a worktree path that got resolved to main repo).

### `GET /api/features` (unchanged contract)

No API contract changes. The only behavioral change is which repo is queried when no params are provided.

## Migration Path

1. **Registry format migration** is automatic: `getWorkspaces()` detects the old array format and auto-migrates to the new object format on first read. The migration is idempotent — subsequent reads of the new format are no-ops.

2. **No breaking changes**: All existing API calls with explicit params work identically. Only the no-params default changes.

3. **Server bundle rebuild required**: After implementation, `pnpm -C apps/server build` to update `dist/index.js`.

## Risks

| Risk                                                  | Mitigation                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registry file corruption during concurrent writes     | Atomic write: write to temp file, then `fs.renameSync` (replaces current `writeFileSync`)                                                                                |
| `git rev-parse --git-common-dir` fails in non-git dir | Wrap in try/catch, fall back to rejecting the path                                                                                                                       |
| Cache grows unbounded with many workspaces            | Map entries are small (worktree list + branch list); not a practical concern for <100 repos                                                                              |
| Older server builds reading new registry format       | Migration preserves the `workspaces` array at the same path; older builds that read the raw array will fail gracefully (empty workspace list) but won't corrupt the file |
| Stale workspace in registry (dir deleted)             | Preserved in registry; `getDefaultRepo()` validates path exists before returning; feature queries return empty list                                                      |
