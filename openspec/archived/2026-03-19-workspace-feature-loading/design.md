# Design: Workspace-Based Feature Loading

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │  ~/.config/local-review/         │
                    │    workspaces.json               │
                    │  ┌───────────────────────────┐   │
                    │  │ lastActive: "review"      │   │
                    │  │ workspaces: [             │   │
                    │  │   {name, path, addedAt},  │   │
                    │  │   ...                     │   │
                    │  │ ]                         │   │
                    │  └───────────────────────────┘   │
                    └──────────┬──────────────────────┘
                               │ read/write
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
  2. defaultRepo = getDefaultRepo() || repoRoot         // NEW — read lastActive from registry
  3. registerWorkspace(defaultRepo)                      // register if not present
  4. refreshGitState(defaultRepo)                        // populate cache for default
  5. startWatcher(defaultRepo)                           // watch default repo
```

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
  │    └─ Set lastActive = name
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
  │                          ↑ NEW: reads lastActive from registry
  │                          Falls back to static repoRoot if registry empty
  │
  ├─ features route handler:
  │    ├─ getGitState(repoRoot) ──▶ per-workspace cache lookup
  │    │   └─ if miss: refreshGitState(repoRoot) ──▶ populate cache
  │    ├─ Pass 1-3: unchanged logic using cached git state
  │    └─ setLastActive(repoRoot) ──▶ update registry
  │
  └─ Return { features: [...], repoName }
```

## File Changes

### 1. `apps/server/src/workspaces.ts` — Registry Module

**Changes:**

- Add `lastActive` field to the registry JSON schema
- Add `getDefaultRepo(): string | null` — returns the path of the `lastActive` workspace
- Add `setLastActive(nameOrPath: string): void` — updates `lastActive` in registry
- Modify `registerWorkspace(inputPath)`:
  - Detect worktree (`.git` is a file) and resolve via `git rev-parse --git-common-dir`
  - Set `lastActive` to the newly registered workspace
  - Remove the `isRealRepo` check that silently rejects worktrees
- Add `addedAt` timestamp to workspace entries (optional, for future sorting)

**New registry schema:**

```json
{
  "lastActive": "review",
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

**Migration:** The current schema is a flat array `[{name, path}]`. On first read, detect the old format (array at root) and auto-migrate to the new object format with `lastActive` set to the first entry's name.

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

- After computing static `repoRoot`, call `getDefaultRepo()` to determine the effective default
- Pass the effective default (not static `repoRoot`) to `refreshGitState()` and `startWatcher()`
- Keep `registerWorkspace(repoRoot)` to ensure the plugin repo is always registered

### 5. `apps/server/src/routes/features.ts` — Cache Access

**Changes:**

- Replace `getGitState()` (no-arg) calls with `getGitState(repoRoot)` (pass the resolved repo path)
- On cache miss, call `refreshGitState(repoRoot)` before proceeding
- After serving features, call `setLastActive(repoRoot)` to track activity
- Remove the `isOverride` distinction — all repos use the same cache-lookup pattern

### 6. `apps/server/src/watcher.ts` — Multi-Workspace Watch (R7, stretch)

**Changes:**

- Maintain a `Set<string>` of watched paths
- `startWatcher(repoPath)` adds watch paths for a specific repo and tracks them
- `stopWatcher(repoPath)` removes watch paths for a specific repo
- On workspace registration, call `startWatcher(newRepoPath)`
- On file change, use the watched path to determine which repo's cache to invalidate via `clearGitState(repoPath)`

### 7. `hooks/session-start.sh` — Worktree Resolution

**Changes:**

- After `git rev-parse --show-toplevel`, add `git rev-parse --git-common-dir` to resolve worktrees
- POST the resolved main repo path instead of the raw worktree path
- This is a defense-in-depth measure — the server also resolves, but resolving client-side avoids unnecessary round-trips

## API Contract Changes

### `GET /api/workspaces` (unchanged response shape)

No changes. Returns the same workspace list.

### `POST /api/workspaces/register` (unchanged request, enhanced response)

**Request:** `{ "path": "/some/path" }` — unchanged

**Response:** `{ "added": boolean, "workspace": { "name": string, "path": string } }` — adds `workspace` field showing the resolved workspace (useful when input was a worktree path).

### `GET /api/features` (unchanged)

No API contract changes. The only behavioral change is which repo is queried when no params are provided.

## Migration Path

1. **Registry format migration** is automatic: `getWorkspaces()` detects the old array format and migrates to the new object format on first read. The migration is idempotent.

2. **No breaking changes**: All existing API calls with explicit params work identically. Only the no-params default changes.

3. **Server bundle rebuild required**: After implementation, `pnpm -C apps/server build` to update `dist/index.js`.

## Risks

| Risk                                                  | Mitigation                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Registry file corruption during concurrent writes     | Use atomic write (write to temp file, rename) — already done in current `workspaces.ts`     |
| `git rev-parse --git-common-dir` fails in non-git dir | Wrap in try/catch, fall back to rejecting the path                                          |
| Cache grows unbounded with many workspaces            | Map entries are small (worktree list + branch list); not a practical concern for <100 repos |
| Old clients expect array format in workspaces.json    | Migration preserves the `workspaces` array; only adds `lastActive` at root level            |
