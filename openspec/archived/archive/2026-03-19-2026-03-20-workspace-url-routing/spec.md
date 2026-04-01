# Workspace-Based URL Routing

**Schema**: feature-rapid
**Date**: 2026-03-20
**Status**: draft

## Summary

Replace query-parameter-based workspace context (`?workspace=typewriter`) with path-based URL segments (`/workspace/typewriter/...`). The root URL (`/`) retains its current "All workspaces" behavior. This is a UI-only refactor -- server API endpoints continue using `?workspace=` query parameters unchanged.

## Motivation

Query-parameter workspace context has three problems:

1. **URLs are ugly and non-hierarchical.** `/features/my-feature/code?workspace=typewriter` buries the scope in a query string. Path segments (`/workspace/typewriter/features/my-feature/code`) read naturally and communicate hierarchy.
2. **Tab links already lose the workspace.** FeatureNavBar tab `<Link>` elements use plain paths like `/features/:id/code` without preserving `?workspace=`, which is an existing bug. Path-based routing eliminates this entire class of bugs because the workspace segment is baked into the URL prefix.
3. **Bookmarks and link-sharing are fragile.** Query params are easily stripped by tools, markdown renderers, and copy-paste. Path segments survive these operations.

## Requirements

### Functional

- **R1**: URLs under a specific workspace use the pattern `/workspace/:workspaceName/...`
  - `/workspace/typewriter` -- Dashboard filtered to `typewriter`
  - `/workspace/typewriter/features/:featureId` -- Feature detail (with default tab redirect)
  - `/workspace/typewriter/features/:featureId/tasks` -- Tasks tab
  - `/workspace/typewriter/features/:featureId/code` -- Code tab
- **R2**: The root URL `/` shows the "All workspaces" dashboard (current behavior, unchanged).
- **R3**: Feature detail routes without a workspace prefix also work: `/features/:featureId/tasks`. These render without workspace scoping (useful for direct links where workspace is unknown).
- **R4**: No legacy URL support. Old `?workspace=` query-param URLs are not redirected — they simply stop working.
- **R5**: Workspace switcher on the Dashboard navigates to `/workspace/:name` or `/` (for "All workspaces") instead of writing to search params.
- **R6**: All internal navigation links (FeatureRow, FeatureNavBar back link, feature switcher, tab links) produce path-based URLs when a workspace is active.
- **R7**: API calls (`featureApi.ts`) continue using `?workspace=` query parameters. The browser URL scheme and the API URL scheme are independent.
- **R8**: The `commands/open.md` slash command produces the new path-based URLs when constructing browser links.
- **R9**: Remove all `repo` naming convention from the UI codebase. The `?repo=` query parameter and any `repo`-named variables/functions/hooks are replaced with `workspace` naming throughout. The server middleware already supports `?workspace=` — `?repo=` is dropped.
- **R10**: Invalid or unknown workspace names in `/workspace/:unknownName/...` degrade gracefully to an empty feature list with the workspace selector visible. No error page.

### Non-Functional

- **NF1**: Zero server-side changes. All routing changes are confined to `apps/ui/` and `commands/open.md`.

## Non-Goals

- Changing server API query parameter conventions.
- Adding workspace context to API calls that currently lack it (e.g., feature-specific endpoints like `/api/features/:id/spec`).
- Changing the `?source=` or `?worktree=` standalone review page parameters.

## Acceptance Criteria

1. Navigating to `/workspace/typewriter` shows the Dashboard filtered to the `typewriter` workspace.
2. Navigating to `/` shows the Dashboard in "All workspaces" mode.
3. Navigating to `/workspace/typewriter/features/2026-03-19-foo/code` renders the Code tab with workspace context preserved in the navbar back link, feature switcher, and tab links.
4. Tab links in FeatureNavBar preserve the workspace segment (fixing the existing bug).
5. Switching workspace in the Dashboard popover navigates to `/workspace/:name` or `/`.
6. API calls in the network tab still use `?workspace=` query parameters.
7. No `repo` naming remains in UI hooks, helpers, or components — all consolidated to `workspace`.
