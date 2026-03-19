# Centralized Session Storage — Design

## Approaches Considered

### A. Central config directory (selected)

Store sessions at `~/.config/local-review/workspace/{repoName}/sessions/`. Mirrors the workspace registry pattern. Single source of truth regardless of server cwd.

**Pros**: Survives repo deletion, consistent across instances, aligns with existing `~/.config/local-review/` convention.
**Cons**: Requires migration, shell scripts need updating.

### B. Symlink from repo to central location

Keep the `.review/sessions/` path but make it a symlink to the central location.

**Pros**: Zero code changes for path resolution. Shell scripts work as-is.
**Cons**: Symlinks are fragile (break on repo move), platform-dependent behavior on Windows (if ever relevant), adds invisible indirection that confuses debugging. Rejected.

### C. Database (SQLite)

Replace JSON files with a SQLite database at `~/.config/local-review/sessions.db`.

**Pros**: Proper querying, concurrent access handled by SQLite.
**Cons**: Massive scope increase. JSON files are human-readable and editable — important for a dev tool. The resolver daemon reads/writes session files directly. Rejected as over-engineering for the current scale.

## Selected Approach: Central Config Directory

### New Module: `apps/server/src/sessions.ts`

This module owns all session path resolution and migration logic.

```typescript
// apps/server/src/sessions.ts

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/** Lazily resolved to support test injection via setConfigDir(). */
let configDir: string | null = null;

function getConfigDir(): string {
  if (!configDir)
    configDir = path.join(os.homedir(), ".config", "local-review");
  return configDir;
}

/** Test-only: override the config directory root. */
export function setConfigDir(dir: string): void {
  configDir = dir;
}

/**
 * Returns the central sessions directory for a given workspace name.
 * Creates the directory if it does not exist.
 */
export function getSessionsDir(repoName: string): string {
  const dir = path.join(getConfigDir(), "workspace", repoName, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

Key design decisions:

- `mkdirSync` with `recursive: true` on every call. The syscall is a no-op when the directory exists (just a stat check), so there is no meaningful performance cost. This eliminates the need for separate "ensure" calls scattered across route handlers.
- The function is synchronous because `fs.mkdirSync` is fast and the path is local filesystem. All callers are already in async handlers that can tolerate a synchronous mkdir.

### Deriving repoName from Request Context

The session CRUD routes currently receive `repoRoot` from the repo middleware. They need `repoName` to call `getSessionsDir()`. Two options:

**Option A**: Add `repoName` to the middleware context (alongside `repoRoot`).
**Option B**: Derive it inline via `path.basename(repoRoot)`.

Selected: **Option A**. The middleware already resolves the workspace. Adding `repoName` to `AppEnv.Variables` is a one-line change and avoids duplicating `getRepoName()` logic (which handles worktrees via `git rev-parse --git-common-dir`). The `getRepoName()` function already exists in `features.ts` and should be extracted to a shared utility.

```typescript
// Updated AppEnv
export type AppEnv = {
  Variables: {
    repoRoot: string;
    repoName: string;
  };
};
```

The middleware looks up the workspace name from the registry (which already stores `name` per workspace). For unregistered repos (direct `?repo=` param), it falls back to `path.basename()`.

### Session Read with Fallback

For backward compatibility (R10), session reads check the central location first, then fall back to the legacy repo-local path.

```typescript
/**
 * Read a session file, checking central location first, then legacy fallback.
 * Returns { content, source } where source indicates where it was found.
 */
export async function readSessionFile(
  repoName: string,
  repoRoot: string,
  fileName: string,
): Promise<{ content: string; source: "central" | "legacy" } | null> {
  const centralPath = path.join(getSessionsDir(repoName), fileName);
  try {
    const content = await fs.promises.readFile(centralPath, "utf-8");
    return { content, source: "central" };
  } catch {
    // Fall back to legacy location
    const legacyPath = path.join(repoRoot, ".review", "sessions", fileName);
    try {
      const content = await fs.promises.readFile(legacyPath, "utf-8");
      return { content, source: "legacy" };
    } catch {
      return null;
    }
  }
}
```

Write operations always target the central location. This means that after the first save triggered by any edit, the file "migrates" to central storage naturally.

### Session Write with Atomic Writes

```typescript
import { atomicWriteSync } from "./workspaces.js";

/**
 * Write a session file to the central location using atomic write.
 * Always stamps repoName on the session data (R6).
 */
export function writeSessionFile(
  repoName: string,
  fileName: string,
  data: string,
): void {
  // Ensure repoName is always present in persisted session data
  try {
    const parsed = JSON.parse(data);
    parsed.repoName = repoName;
    data = JSON.stringify(parsed, null, 2);
  } catch {
    // If data isn't valid JSON, write as-is
  }
  const filePath = path.join(getSessionsDir(repoName), fileName);
  atomicWriteSync(filePath, data);
}
```

Note: `atomicWriteSync` is currently defined in `workspaces.ts`. It should be extracted to a shared `apps/server/src/fs-utils.ts` module so both `workspaces.ts` and `sessions.ts` can import it without circular dependencies.

### Migration Function

```typescript
/**
 * Migrate sessions from a repo's legacy .review/sessions/ to central storage.
 * Copies (not moves) files. Adds repoName field to migrated sessions.
 * Uses newer-wins conflict resolution: compares metadata.updatedAt timestamps
 * (or file mtime as fallback) when both central and legacy copies exist.
 */
export async function migrateRepoSessions(
  repoName: string,
  repoPath: string,
): Promise<{ migrated: number; skipped: number }> {
  const legacyDir = path.join(repoPath, ".review", "sessions");
  const centralDir = getSessionsDir(repoName);
  let migrated = 0;
  let skipped = 0;

  let entries: string[];
  try {
    entries = await fs.promises.readdir(legacyDir);
  } catch {
    return { migrated: 0, skipped: 0 }; // No legacy dir
  }

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const srcPath = path.join(legacyDir, entry);
    const destPath = path.join(centralDir, entry);

    try {
      const raw = await fs.promises.readFile(srcPath, "utf-8");
      const session = JSON.parse(raw);

      // Newer-wins conflict resolution
      try {
        const destRaw = await fs.promises.readFile(destPath, "utf-8");
        const destSession = JSON.parse(destRaw);
        const srcTime = session.metadata?.updatedAt
          ? new Date(session.metadata.updatedAt).getTime()
          : (await fs.promises.stat(srcPath)).mtimeMs;
        const destTime = destSession.metadata?.updatedAt
          ? new Date(destSession.metadata.updatedAt).getTime()
          : (await fs.promises.stat(destPath)).mtimeMs;
        if (destTime >= srcTime) {
          skipped++;
          continue; // Central copy is newer or equal — keep it
        }
      } catch {
        // Destination doesn't exist — proceed with migration
      }

      session.repoName = repoName;
      atomicWriteSync(destPath, JSON.stringify(session, null, 2));
      migrated++;
    } catch {
      // Skip malformed files
    }
  }

  return { migrated, skipped };
}
```

Migration triggers:

- **On server startup**: For each registered workspace, call `migrateRepoSessions()`. This is fire-and-forget (non-blocking).
- **Not on every request**: Migration is a one-time operation per workspace, not a per-request check.

### Watcher Redesign

The current `startSessionWatcher()` is a standalone function that watches a single directory. It needs to become per-workspace, like `gitWatchers`.

```typescript
// In watcher.ts

const sessionWatchers = new Map<string, FSWatcher>();

/**
 * Start watching a workspace's central sessions directory.
 * No-ops if already watching this workspace.
 */
export function startSessionWatcher(
  repoName: string,
  sessionsDir: string,
): void {
  if (sessionWatchers.has(repoName)) return;

  const watcher = chokidar
    .watch(sessionsDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    .on("change", (filePath: string) => {
      if (!filePath.endsWith(".json")) return;
      void (async () => {
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const session = JSON.parse(content) as unknown;
          const fileName = path.basename(filePath);
          broadcast({
            event: WS_EVENTS.SESSION_UPDATED,
            data: { repoName, fileName, session },
          });
        } catch {
          // File may be mid-write or invalid JSON
        }
      })();
    });

  sessionWatchers.set(repoName, watcher);
}

/**
 * Stop watching a workspace's sessions directory.
 */
export function stopSessionWatcher(repoName: string): void {
  const watcher = sessionWatchers.get(repoName);
  if (watcher) {
    void watcher.close();
    sessionWatchers.delete(repoName);
  }
}
```

Startup changes in `index.ts`:

- Remove the module-level `sessionsDir` constant.
- After loading the workspace registry, **migrate then watch** for each workspace (order matters):

```typescript
// In server startup (index.ts)
const workspaces = getWorkspaces();
for (const ws of workspaces) {
  // Migration first, watcher second — avoids watcher firing on migration writes
  await migrateRepoSessions(ws.name, ws.path).catch(() => {});
  startSessionWatcher(ws.name, getSessionsDir(ws.name));
}
```

- When a new workspace is registered via `/api/workspaces/register`, migrate and start its session watcher (alongside the git watcher).
- **Failure isolation**: Each workspace's migration and watcher are independent. A failure in one workspace (e.g., missing directory) must not prevent others from starting.

### Resolver Endpoint Fix

The `/api/resolver/resolve` endpoint in `index.ts` currently uses the module-level `sessionsDir`. It needs to:

1. Extract `repoName` from the request context (set by middleware).
2. Use `getSessionsDir(repoName)` to locate the session file.

```typescript
app.post("/api/resolver/resolve", async (c) => {
  const repoName = c.get("repoName");
  const repoRoot = c.get("repoRoot");
  const { featureId, sessionType } = await c.req.json();
  const suffix = sessionType === "code" ? "-code.json" : "-spec.json";
  const fileName = `${featureId}${suffix}`;
  const sessionsDir = getSessionsDir(repoName);
  const sessionFile = path.join(sessionsDir, fileName);
  // ... rest unchanged
});
```

The resolver endpoint also needs to be moved behind the repo middleware. Currently it is at `/api/resolver/resolve` which IS under `/api/*` and thus already has `repoRoot` from middleware. It just ignores it. After this change, it reads both `repoRoot` and `repoName` from context.

### Route Handler Changes

**`createSessionsRoute()` signature change**: The function currently accepts `repoRoot`-derived parameters (`_sessionsDir`, `_ensureSessionsDir`). These must be removed entirely — the function no longer receives session paths as arguments. Instead, each inner handler reads `repoName` and `repoRoot` from the Hono context (`c.get()`).

```typescript
// Before:
export function createSessionsRoute(repoRoot: string) { ... }

// After:
export function createSessionsRoute() { ... }
// Inner handlers use c.get("repoName") and c.get("repoRoot")
```

In each handler:

```typescript
// Before:
const sessionsDir = path.join(repoRoot, ".review", "sessions");

// After:
const repoName = c.get("repoName");
const repoRoot = c.get("repoRoot");
const sessionsDir = getSessionsDir(repoName);
```

The `repoRoot` variable is still needed for the fallback read path (R10) but not for writes.

**PATCH handler**: The PATCH route reads a session file before writing (to merge the thread patch). It must also use `readSessionFile()` with fallback logic, not just central-path reads.

In `features.ts`, the `sessionsDir` construction changes similarly. The `getRepoName()` subprocess call (spawning `git rev-parse`) in `features.ts` becomes dead code once middleware provides `repoName` — **delete it explicitly**.

### Shared Utility Extraction

Two functions currently duplicated or misplaced need extraction:

1. **`atomicWriteSync()`** — currently a private function in `workspaces.ts` (not exported). Must be extracted to `apps/server/src/fs-utils.ts` and exported. Both `workspaces.ts` and `sessions.ts` import from `fs-utils.ts`.
2. **`getRepoName()`** — currently in `features.ts` (spawns `git rev-parse`). Becomes dead code after middleware provides `repoName` from the workspace registry. Delete it.

### Middleware repoName Resolution

**Important**: `resolveWorkspace()` in `workspaces.ts` returns a path string, not a workspace name. The middleware must perform an additional lookup against the workspace registry to extract the `name` field for the resolved path.

```typescript
// In repo middleware:
const repoRoot = resolveWorkspace(param); // returns absolute path
const workspace = getWorkspaces().find((w) => w.path === repoRoot);
const repoName = workspace?.name ?? path.basename(repoRoot);
c.set("repoName", repoName);
```

This ensures registered repos use their canonical (possibly disambiguated) name, while unregistered repos fall back to `path.basename()`.

Decision: use the workspace registry `name` when available, fall back to `path.basename(repoRoot)` for unregistered repos.

### Shell Script Update

`scripts/resolve-async/run.sh` hardcodes `SESSIONS_DIR="$REPO_ROOT/.review/sessions"`. Options:

1. Accept `--sessions-dir <path>` flag.
2. Read the workspace registry JSON and derive the path.
3. Query the server API for the session file location.

Selected: **Option 2**. The script already uses `jq` and can read `~/.config/local-review/workspaces.json` to find the workspace name, then construct the path.

```bash
# Derive sessions dir from workspace registry (uses registered name, not basename)
WORKSPACE_FILE="$HOME/.config/local-review/workspaces.json"
if [[ -f "$WORKSPACE_FILE" ]]; then
  REPO_NAME=$(jq -r --arg p "$REPO_ROOT" '.workspaces[] | select(.path == $p) | .name' "$WORKSPACE_FILE")
  if [[ -n "$REPO_NAME" ]]; then
    SESSIONS_DIR="$HOME/.config/local-review/workspace/$REPO_NAME/sessions"
  else
    SESSIONS_DIR="$REPO_ROOT/.review/sessions"  # unregistered repo fallback
  fi
else
  SESSIONS_DIR="$REPO_ROOT/.review/sessions"  # no registry fallback
fi
```

### Component Impact Summary

| Component                            | Change                                                                        | Risk                         |
| ------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| `apps/server/src/sessions.ts` (NEW)  | Session path utility, read/write helpers, migration                           | Low — new module             |
| `apps/server/src/fs-utils.ts` (NEW)  | Extract `atomicWriteSync`                                                     | Low — move only              |
| `apps/server/src/types.ts`           | Add `repoName` to `AppEnv.Variables`                                          | Low — additive               |
| `apps/server/src/middleware/repo.ts` | Resolve and set `repoName`                                                    | Medium — all routes affected |
| `apps/server/src/routes/sessions.ts` | Replace inline path with `getSessionsDir()`                                   | Medium — 5 call sites        |
| `apps/server/src/routes/features.ts` | Replace inline path, extract `getRepoName()`                                  | Medium — 3 call sites        |
| `apps/server/src/index.ts`           | Remove module-level `sessionsDir`, fix resolver, multi-workspace watcher init | High — startup flow          |
| `apps/server/src/watcher.ts`         | `sessionWatchers` Map, `repoName` in broadcast                                | Medium — behavioral change   |
| `apps/server/src/workspaces.ts`      | Export `atomicWriteSync` or move to fs-utils                                  | Low                          |
| `scripts/resolve-async/run.sh`       | Derive sessions dir from registry                                             | Low                          |
| `commands/resolve.md`                | Update path references                                                        | Low — docs only              |

### Data Flow

```
Request arrives
  -> repoMiddleware resolves repoRoot + repoName (from registry or basename)
  -> Route handler calls getSessionsDir(repoName)
  -> Read: check central path, fallback to legacy
  -> Write: always to central path (atomic)
  -> Watcher detects change, broadcasts { repoName, fileName, session }
  -> UI receives event, filters by fileName (ignores repoName for now)
```

### Testing Strategy

Tests live in `apps/server/src/__tests__/sessions.test.ts` (or colocated as `sessions.test.ts`).

**Unit tests for `getSessionsDir()`**:

- Returns correct path for a given repoName
- Creates directory on first call
- Is idempotent (second call returns same path, no error)

**Unit tests for `readSessionFile()`**:

- Reads from central location when file exists
- Falls back to legacy location when central is missing
- Returns null when neither location has the file
- Returns correct `source` indicator

**Unit tests for `writeSessionFile()`**:

- Writes to central location
- Creates parent directory if needed
- Uses atomic write (file appears atomically, no partial writes)

**Unit tests for `migrateRepoSessions()`**:

- Copies files from legacy to central location
- Adds `repoName` field to migrated files
- Newer-wins: overwrites older central file with newer legacy file
- Newer-wins: keeps newer central file when legacy is older
- Handles empty legacy directory
- Handles missing legacy directory
- Handles malformed JSON files (skips without crashing)

**Unit tests for watcher**:

- `startSessionWatcher()` creates a watcher for a new workspace
- `startSessionWatcher()` no-ops for already-watched workspace
- `stopSessionWatcher()` closes and removes the watcher
- Broadcast payload includes `repoName`

**Integration tests**:

- Middleware resolves `repoName` from workspace registry for registered repos
- Middleware falls back to `path.basename()` for unregistered repos
- Resolver endpoint reads from correct workspace session dir
- Startup migration runs for all registered workspaces
- Newer-wins conflict resolution picks the correct file during migration
- End-to-end: save session via API → file appears at central path with `repoName` stamped

**Test environment**: Tests should use `$TMPDIR` for file operations to avoid polluting the real config directory. Mock `os.homedir()` or inject the config dir path.
