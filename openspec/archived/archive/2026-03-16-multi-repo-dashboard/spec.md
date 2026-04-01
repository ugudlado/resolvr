# Spec: Multi-Repo Dashboard

**Feature ID**: 2026-03-16-multi-repo-dashboard
**Schema**: feature-rapid
**Date**: 2026-03-16

## Motivation

The local-review server hardcodes `repoRoot` to the plugin install directory. When a user works across multiple repositories (e.g., via worktrees or separate projects), every dashboard session shows features from the same repo. There is no way to view features for a different project without restarting the server with a different working directory.

This feature makes the dashboard repo-aware by allowing the repo context to flow from the open command through the URL into API calls, so a single running server instance can serve any repository on the user's machine.

## Requirements

### R1: Server accepts repo root via query parameter

The server API must accept an optional `repo` query parameter on all `/api/*` endpoints. When provided, it overrides the default `repoRoot` for that request's scope.

- Example: `GET /api/features?repo=/Users/spidey/code/other-project`
- When `repo` is absent, the server falls back to the current hardcoded default (plugin install directory).
- The parameter must be resolved to an absolute path on the server (expand `~`, resolve relative segments).

### R2: UI passes repo context via URL

The dashboard reads a `repo` URL search parameter and injects it into all API calls.

- `http://localhost:37003?repo=/Users/spidey/code/myproject` shows features for myproject.
- `http://localhost:37003` shows features for the default repo.
- The `repo` param must persist across client-side navigation (e.g., navigating from dashboard to a feature's code review and back).

### R3: Open command passes repo context

The `/local-review:open` slash command must detect the current working directory of the invoking Claude session and pass it as the `repo` URL parameter.

- The constructed URL becomes: `http://localhost:37003?repo=<cwd>`
- Existing `--worktree` and `--source` params continue to work alongside `repo`.

### R4: Dashboard shows repo identifier

The dashboard header must display which repository is being viewed, derived from the repo path.

- Display the directory basename (e.g., `/Users/spidey/code/myproject` shows "myproject").
- When viewing the default repo (no `repo` param), show the default repo's basename.

### R5: Security -- validate repo paths

The server must validate the `repo` query parameter before using it.

- Reject paths that do not exist on disk.
- Reject paths that are not git repositories (no `.git` directory or file).
- Reject paths containing `..` segments (path traversal).
- Return HTTP 400 with a descriptive error message on validation failure.

## Scope

### In scope

- Per-request repo override via query parameter on all API routes.
- UI plumbing to read and propagate the repo param.
- Open command enhancement to pass current working directory.
- Repo path validation on the server.
- Dashboard header showing repo name.

### Out of scope

- Multi-repo views (showing features from multiple repos simultaneously).
- Repo selection UI (dropdown, picker). Users switch repos by changing the URL param.
- Persisting repo preference across browser sessions.
- Server-side caching of multiple repo states.
- Changes to the SessionStart hook (the server already runs once; repo context is per-request).

## Acceptance Criteria

1. **AC-1**: `GET /api/features?repo=/path/to/valid/repo` returns features scoped to that repo.
2. **AC-2**: `GET /api/features` (no param) returns features for the default repo, identical to current behavior.
3. **AC-3**: `GET /api/features?repo=/nonexistent` returns HTTP 400.
4. **AC-4**: `GET /api/features?repo=/tmp` (not a git repo) returns HTTP 400.
5. **AC-5**: `GET /api/features?repo=/path/../etc/passwd` returns HTTP 400.
6. **AC-6**: Opening `http://localhost:37003?repo=/path/to/repo` shows features for that repo and displays the repo name in the header.
7. **AC-7**: Navigating from dashboard to `/features/:id/code` and back preserves the `repo` param.
8. **AC-8**: The `/local-review:open` command includes `repo=<cwd>` in the generated URL.
