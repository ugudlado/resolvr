# Centralized Session Storage

**Feature ID**: 2026-03-20-centralized-session-storage
**Schema**: feature-tdd
**Date**: 2026-03-20

## Problem

Review sessions are stored inside each repository at `{repoRoot}/.review/sessions/`. This causes three concrete problems:

1. **Data loss on repo deletion**: Deleting or re-cloning a repository destroys all associated review sessions.
2. **Multi-workspace bug (existing)**: The `/api/resolver/resolve` endpoint and `startSessionWatcher()` both use a module-level `sessionsDir` derived from the plugin's own `repoRoot` (line 36 of `index.ts`), not the per-request workspace. Sessions for any workspace other than the plugin repo are silently read from / written to the wrong directory. This is already broken.
3. **Inconsistency across server instances**: If the server is started from different directories (or via different plugin installations), sessions resolve to different physical locations.

The workspace registry already lives at `~/.config/local-review/workspaces.json`. Session storage should follow the same centralized pattern.

## Solution

Move session storage from `{repoRoot}/.review/sessions/` to `~/.config/local-review/workspace/{repoName}/sessions/`, where `repoName` is the workspace name from the registry (e.g., "review", "lens", "shell").

Introduce a single `getSessionsDir(repoName)` utility that all server code uses. Replace every inline `path.join(repoRoot, ".review", "sessions")` with calls to this utility.

## Requirements

### Functional

**R1 — Central session path utility**
A function `getSessionsDir(repoName: string): string` returns `~/.config/local-review/workspace/{repoName}/sessions/`. Exported from a new module `apps/server/src/sessions.ts`.

**R2 — Session CRUD routes use central path**
All GET/POST/DELETE/PATCH handlers in `sessions.ts` resolve session paths via `getSessionsDir()` instead of `path.join(repoRoot, ".review", "sessions")`.

**R3 — Feature routes use central path**
Session lookups in `features.ts` (feature list endpoint) use `getSessionsDir()` for reading session files.

**R4 — Per-workspace session watcher**
`startSessionWatcher()` evolves from a singleton to a per-workspace model using `Map<repoName, FSWatcher>`, paralleling the existing `gitWatchers` pattern. Watchers are started when workspaces become active and stopped when removed.

**R5 — Resolver endpoint uses request context**
The `/api/resolver/resolve` endpoint derives its session path from the request's repo context (via middleware), not the module-level `sessionsDir` constant.

**R6 — Session file schema adds repoName**
Session JSON files include a `repoName` field for attribution and portability. Existing sessions without this field remain readable (optional field). The server-side write helpers **always stamp `repoName`** on every save and patch — not just during migration. This ensures all centrally-written sessions are fully attributed.

**R7 — WebSocket broadcast includes repoName**
`SESSION_UPDATED` events include `repoName` alongside `fileName` so the UI can filter by workspace when multi-workspace views are active. [ASSUMPTION] The UI will initially ignore this field — multi-workspace UI filtering is a separate feature.

**R8 — Migration utility**
A `migrateRepoSessions(repoName, repoPath)` function scans `{repoPath}/.review/sessions/` and copies files to the central location. It adds the `repoName` field to each migrated file. Migration uses **newer-wins conflict resolution**: when a file exists at both locations, compare `metadata.updatedAt` timestamps (or file mtime as fallback) and keep the newer version. Migration runs **at server startup** for all registered workspaces (fire-and-forget, non-blocking).

**R9 — Shell script and command references updated**
`scripts/resolve-async/run.sh` accepts a `--sessions-dir` flag or derives the session directory from the workspace registry. `commands/resolve.md` documentation updated to reflect the new path.

**R10 — Backward compatibility (transition period)**
When reading a session that does not exist at the central location, fall back to `{repoRoot}/.review/sessions/`. This handles the case where migration has not yet run. Write operations always target the central location. [ASSUMPTION] The fallback can be removed in a future version after one release cycle.

### Non-Functional

**NF1 — Test coverage >= 90%**
Unit tests for the session path utility, migration function (including conflict resolution), watcher lifecycle, and fallback logic. Integration tests for middleware-provided `repoName`, resolver endpoint routing, and startup migration flow.

**NF2 — Atomic writes**
Session writes use the `atomicWriteSync` pattern from `workspaces.ts` to prevent corruption on concurrent access.

**NF3 — No UI changes**
The API contract (URL paths, JSON shapes) remains identical. The UI is unaware of the storage relocation. The only additive change is the `repoName` field in WebSocket payloads (which the UI can safely ignore).

## Non-Goals

- **UI workspace scoping**: Filtering sessions by workspace in the UI is a separate feature. This change only ensures the server stores and retrieves sessions from the correct centralized location.
- **Session format migration**: Beyond adding `repoName`, the session JSON schema is unchanged. No thread format changes, no key renames.
- **Multi-server locking**: Concurrent server instances writing to the same session file is not addressed. The atomic write pattern provides crash safety but not cross-process coordination.

## Acceptance Criteria

- AC1: `getSessionsDir("review")` returns `~/.config/local-review/workspace/review/sessions/`
- AC2: Saving a session via `POST /api/features/:id/code-session?workspace=review` writes to the central location, not `{repoRoot}/.review/sessions/`
- AC3: Starting the server with two registered workspaces creates two session watchers (one per workspace)
- AC4: The resolver endpoint reads session files from the correct workspace, not the plugin's own repo
- AC5: Existing sessions in `{repoRoot}/.review/sessions/` are readable via the fallback path
- AC6: After migration, `{repoRoot}/.review/sessions/` files are present at the central location with `repoName` field added
- AC7: WebSocket `SESSION_UPDATED` events include `repoName`
- AC8: All unit tests pass with >= 90% coverage on the sessions module

## Edge Cases

### Workspace name collisions

Two repos with the same directory name (e.g., `~/work/review` and `~/personal/review`) would produce the same `repoName` key and share a session directory. This is a workspace registry limitation (it already uses `path.basename()` as the name). **Deferred**: Unique workspace naming is a registry-level concern to be addressed holistically — not patched in the session storage layer. For now, session storage inherits whatever name the registry provides.

### Worktree resolution

Worktrees are already resolved to their main repo via `resolveWorktreePath()`. The `repoName` is derived from the main repo, not the worktree directory name. This is correct and consistent.

### Concurrent server instances

Two server instances watching the same central session directory would both detect changes and broadcast. This is acceptable — the UI's `skipNextUpdate` ref already handles echo suppression, and chokidar's `awaitWriteFinish` debounces rapid writes.

### Migration during active use

Migration runs **at server startup** (fire-and-forget, non-blocking) for all registered workspaces. If a user is actively using sessions while migration runs, the fallback read + central write pattern ensures no data loss. The migration function copies (not moves) to preserve the original as a backup. Conflict resolution uses newer-wins (comparing `metadata.updatedAt` or file mtime).
