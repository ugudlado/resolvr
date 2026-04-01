# Workspace-Based Feature Loading

## Summary

Decouple feature loading from the server's `cwd` / static `repoRoot` so that features are loaded from the workspace registry (`~/.config/local-review/workspaces.json`) instead. The dashboard defaults to the last-active workspace, and worktree paths auto-resolve to their parent repo.

## Problem

The server currently computes `repoRoot` as a static path relative to `dist/index.js`:

```ts
const repoRoot = path.resolve(__dirname, "../../..");
```

This creates several problems:

1. **cwd-dependent**: The default feature list always shows the plugin's own repo, regardless of which project the user is working on.
2. **Worktree registration silently fails**: `registerWorkspace()` rejects paths where `.git` is a file (worktrees), so starting Claude in a worktree doesn't register anything.
3. **Single git state cache**: `git.ts` uses a module-level `cache` variable that gets overwritten when `?workspace=` triggers `refreshGitState()` for a different repo — potential race condition.
4. **Watcher is single-repo**: The file watcher only watches the default repo's `.git/` directory. Changes in other registered workspaces don't trigger real-time updates.

## Requirements

### R1 — Last-Active Workspace Default

When the dashboard loads without `?workspace=` or `?repo=` params, the server MUST return features from the most recently registered/used workspace (not the static `repoRoot`).

**Acceptance:** `GET /api/features` with no params returns features from the last-active workspace, not necessarily the plugin's own repo.

### R2 — Worktree Auto-Resolution

When a worktree path is passed to `registerWorkspace()` or `POST /api/workspaces/register`, the server MUST resolve it to the main repo root using `git rev-parse --git-common-dir`.

**Acceptance:** Starting Claude in `~/code/feature_worktrees/my-feature/` registers `~/code/review/` (the parent repo) as a workspace.

### R3 — Per-Workspace Git State Cache

The git state cache MUST be keyed by workspace path, not stored as a single module-level variable. Concurrent requests for different workspaces MUST NOT corrupt each other's state.

**Acceptance:** `GET /api/features?workspace=review` followed by `GET /api/features?workspace=lens` returns correct features for each, with no cross-contamination.

### R4 — Active Workspace Tracking

The workspace registry MUST track which workspace was last active (last registered or last queried). This persists across server restarts.

**Acceptance:** `~/.config/local-review/workspaces.json` includes a `lastActive` field (workspace name) that updates on registration and feature queries.

### R5 — Backward Compatibility

Existing `?repo=` and `?workspace=` query params MUST continue to work exactly as before. The only behavioral change is the fallback when neither param is provided.

**Acceptance:** All existing API calls with explicit params produce identical results.

### R6 — Graceful Fallback

If no workspaces are registered (empty registry), the server MUST fall back to the static `repoRoot` (plugin's own repo) and auto-register it.

**Acceptance:** Fresh install with no `workspaces.json` behaves identically to current behavior.

### R7 — Multi-Workspace Watcher (Stretch)

The file watcher SHOULD watch `.git/` for all registered workspaces, not just the default. When a workspace is registered, its `.git/` paths should be added to the watch list.

**Acceptance:** Creating a new worktree in a non-default registered workspace triggers a `review:features-updated` WebSocket broadcast.

## Out of Scope

- UI changes — the dashboard already supports workspace switching via URL params and dropdown
- Aggregating features from ALL workspaces in a single view (user chose last-active default)
- VS Code extension changes (separate feature: 2026-03-19-vscode-annotations)
- Changes to `spec.ts` legacy path (separate cleanup task)

## Edge Cases

| Scenario                                          | Expected Behavior                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Server starts, no `workspaces.json` exists        | Falls back to static `repoRoot`, auto-registers it, creates `workspaces.json` |
| Worktree path registered via hook                 | Auto-resolves to main repo, registers main repo                               |
| Workspace deleted from disk but still in registry | Returns empty feature list, does not crash                                    |
| Two concurrent requests for different workspaces  | Each gets correct git state from per-workspace cache                          |
| `?repo=` points to a worktree path                | Works as before (middleware accepts `.git` file), no auto-resolution          |
| Last-active workspace deleted from registry       | Falls back to first remaining workspace, or static `repoRoot` if empty        |
