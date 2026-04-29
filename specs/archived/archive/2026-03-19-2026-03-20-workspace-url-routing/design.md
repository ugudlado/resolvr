# Design: Workspace-Based URL Routing

## Approach

Use React Router's nested route structure to add an optional `/workspace/:workspaceName` prefix. A shared layout component handles both the "workspace scoped" and "all workspaces" cases. No legacy URL redirect — old `?workspace=` URLs simply stop working.

## Current State (baseline)

The codebase currently uses query-param workspace context:

- `useRepoContext()` reads `workspace` from `useSearchParams()` — returns `{ workspace }`
- `withWorkspace(url, workspace)` appends `?workspace=<name>` to URLs
- `useWorkspaces()` fetches `/api/workspaces`, returns `{ workspaces, loaded }`
- `featureApi.getFeatures(workspace)` / `getWorktrees(workspace)` use `withWorkspace()` for API calls
- Dashboard uses `setSearchParams({ workspace: value })` for workspace switching
- FeatureNavBar tab links do NOT preserve workspace (existing bug)
- `FeatureRow` uses `feature.repoName` for navigation workspace context

## Route Structure (App.tsx)

```
RootLayout (FeaturesProvider)
  /                                                    -> Dashboard (all workspaces)
  /workspace/:workspaceName                            -> Dashboard (filtered)
  /workspace/:workspaceName/features/:featureId        -> FeatureLayout
    index                                              -> FeatureDefaultRedirect
    tasks                                              -> TasksPage
    code                                               -> FeatureCodeTab
  /features/:featureId                                 -> FeatureLayout (no workspace)
    index                                              -> FeatureDefaultRedirect
    tasks                                              -> TasksPage
    code                                               -> FeatureCodeTab
  *                                                    -> NotFound
```

Implementation strategy: define the feature routes once as a reusable `featureChildren` array, then mount them under both `/workspace/:workspaceName/features/:featureId` and `/features/:featureId`. This avoids duplicating route definitions.

```tsx
const featureChildren = [
  { index: true, element: <FeatureDefaultRedirect /> },
  ...(FLAGS.DEV_WORKFLOW
    ? [{ path: FEATURE_TAB.Tasks, element: <TasksPage /> }]
    : []),
  { path: FEATURE_TAB.Code, element: <FeatureCodeTab /> },
];

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: FLAGS.DEV_WORKFLOW ? <Dashboard /> : <StandaloneReviewPage />,
      },
      { path: "/workspace/:workspaceName", element: <Dashboard /> },
      {
        path: "/workspace/:workspaceName/features/:featureId",
        element: <FeatureLayout />,
        children: featureChildren,
      },
      {
        path: "/features/:featureId",
        element: <FeatureLayout />,
        children: featureChildren,
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
```

## Component Changes

### 1. useRepoContext.ts → rename to useWorkspaceContext.ts

The hook changes from reading `?workspace=` search params to reading `:workspaceName` from the URL path via `useParams()`.

```tsx
import { useParams } from "react-router-dom";

export function useWorkspaceContext() {
  const { workspaceName } = useParams<{ workspaceName?: string }>();
  return { workspace: workspaceName ?? null };
}
```

Replace `withWorkspace()` (query-param appender) with two distinct helpers:

**`workspacePath(url, workspace)`** — builds browser navigation URLs with path prefix:

```tsx
/** Prepend /workspace/:name to a browser URL path. */
export function workspacePath(url: string, workspace: string | null): string {
  if (!workspace) return url;
  if (url === "/") return `/workspace/${encodeURIComponent(workspace)}`;
  return `/workspace/${encodeURIComponent(workspace)}${url}`;
}
```

**`withWorkspaceQuery(url, workspace)`** — appends `?workspace=` query param for API calls (same behavior as current `withWorkspace`, renamed for clarity):

```tsx
/** Append ?workspace= query param to an API URL. */
export function withWorkspaceQuery(
  url: string,
  workspace?: string | null,
): string {
  if (!workspace) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}workspace=${encodeURIComponent(workspace)}`;
}
```

A convenience hook for building browser URLs:

```tsx
/** Returns a function that prepends the current workspace path prefix to a URL. */
export function useWorkspacePath() {
  const { workspace } = useWorkspaceContext();
  return (url: string) => workspacePath(url, workspace);
}
```

**Cleanup**: Remove the old `useRepoContext` name and any `repo`-related parameters/variables. All consumers switch to `useWorkspaceContext` / `useWorkspacePath`.

### 2. featureApi.ts

Replace all `withWorkspace()` calls with `withWorkspaceQuery()`. Same behavior, explicit name distinguishing it from the path-based helper.

Affected calls:

- `getWorktrees(workspace?)` — `withWorkspaceQuery(url, workspace)`
- `getFeatures(workspace?)` — `withWorkspaceQuery(url, workspace)`

### 3. Dashboard.tsx

**WorkspaceSwitcher `onChange`**: Instead of `setSearchParams({ workspace: value })`, navigate to the workspace path:

```tsx
const navigate = useNavigate();

function handleWorkspaceChange(value: string) {
  if (!value) {
    navigate("/");
  } else {
    navigate(`/workspace/${encodeURIComponent(value)}`);
  }
}
```

Remove `setSearchParams` usage for workspace switching.

**`fetchFeatures`**: The `workspace` value now comes from `useWorkspaceContext()` (which reads from `useParams`), so the API call logic is unchanged. The `featureApi.getFeatures(workspace)` call still appends `?workspace=` to the API request via `withWorkspaceQuery`.

### 4. FeatureRow.tsx

Replace `withWorkspace(url, workspace)` with the path-based helper:

```tsx
const wp = useWorkspacePath();

function handleActivate() {
  void navigate(wp(`/features/${feature.id}`));
}
```

Note: currently uses `feature.repoName` for workspace context. This should be `feature.repoName` (the server-provided workspace name) piped through `workspacePath` directly, since the URL workspace might differ in "All workspaces" mode.

### 5. FeatureNavBar.tsx

**Back link**: `<Link to={wp("/")}>`

**Feature switcher `handleSwitch`**:

```tsx
void navigate(wp(`/features/${id}/${activeTabPath}`));
```

**Tab links**: `basePath` must include the workspace prefix:

```tsx
const wp = useWorkspacePath();
const basePath = wp(`/features/${featureId}`);
```

This fixes the existing bug where tabs drop workspace context, because `basePath` now includes `/workspace/:name` when applicable. Both link generation and `pathname.startsWith(basePath)` active-tab detection must use the workspace-prefixed path.

### 6. useFeaturesContext.tsx

Currently reads `workspace` from `useSearchParams()`. Must change to read from `useWorkspaceContext()` (path params) and pass to `featureApi.getFeatures(workspace)`:

```tsx
// Before: reads from search params
const workspace = searchParams.get("workspace");

// After: reads from path params via useWorkspaceContext
const { workspace } = useWorkspaceContext();
void featureApi.getFeatures(workspace);
```

### 7. FeatureDefaultRedirect

Currently preserves `?workspace=` via `searchParams.toString()` when redirecting. This no longer needs special handling — the workspace is in the URL path and will be preserved automatically by the route structure. Simplify to a bare redirect.

### 8. commands/open.md

Update URL construction to use path-based workspace segments:

```bash
# Before
open "http://localhost:37003?workspace=$WORKSPACE_NAME"
open "http://localhost:37003/features/$FEATURE_ID/code?workspace=$WORKSPACE_NAME"

# After
open "http://localhost:37003/workspace/$WORKSPACE_NAME"
open "http://localhost:37003/workspace/$WORKSPACE_NAME/features/$FEATURE_ID/code"
```

## Naming Convention Cleanup

All `repo` naming is removed from the UI codebase:

| Old Name                        | New Name                                     |
| ------------------------------- | -------------------------------------------- |
| `useRepoContext()`              | `useWorkspaceContext()`                      |
| `useRepoContext.ts`             | `useWorkspaceContext.ts`                     |
| `withWorkspace()` (query-param) | `withWorkspaceQuery()` (API calls only)      |
| —                               | `workspacePath()` (browser URLs, new)        |
| —                               | `useWorkspacePath()` (convenience hook, new) |
| `feature.repoName`              | unchanged (server-provided, out of scope)    |

## Data Flow Summary

```
Browser URL                          useWorkspaceContext()         API Call
-----------                          --------------------         --------
/workspace/typewriter/features/X     { workspace: "typewriter" }  /api/features?workspace=typewriter
/features/X                          { workspace: null }          /api/features
/                                    { workspace: null }          (fetches all workspaces)
```

## Migration

1. Rename `useRepoContext.ts` → `useWorkspaceContext.ts`, update all imports.
2. Split `withWorkspace` into `workspacePath` (browser) + `withWorkspaceQuery` (API).
3. Add `useWorkspacePath` hook.
4. Update route definitions in `App.tsx` — add `/workspace/:workspaceName` routes + `featureChildren` array.
5. Update all consumers: Dashboard, FeatureRow, FeatureNavBar, useFeaturesContext, FeatureDefaultRedirect.
6. Update `commands/open.md` URL patterns.

No data migration needed — this is purely a URL structure + naming change.

## Files Changed

| File                                                             | Change                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/ui/src/hooks/useRepoContext.ts` → `useWorkspaceContext.ts` | Rename; read workspace from `useParams`; split into `workspacePath` + `withWorkspaceQuery`; add `useWorkspacePath` |
| `apps/ui/src/App.tsx`                                            | Add `/workspace/:workspaceName` routes; extract `featureChildren` array                                            |
| `apps/ui/src/pages/Dashboard.tsx`                                | Navigate instead of `setSearchParams` for workspace switching                                                      |
| `apps/ui/src/components/dashboard/FeatureRow.tsx`                | Use `useWorkspacePath` for navigation URLs                                                                         |
| `apps/ui/src/components/FeatureNavBar.tsx`                       | Use `useWorkspacePath` for back link, feature switcher, and tab base path                                          |
| `apps/ui/src/hooks/useFeaturesContext.tsx`                       | Read workspace from `useWorkspaceContext` instead of search params                                                 |
| `apps/ui/src/services/featureApi.ts`                             | Rename `withWorkspace` → `withWorkspaceQuery`                                                                      |
| `commands/open.md`                                               | Update URL patterns to path-based workspace segments                                                               |

## Edge Cases

- **Workspace name with special characters**: `encodeURIComponent` handles this in path segments. React Router's `useParams` returns the decoded value.
- **Invalid/unknown workspace**: `/workspace/nonexistent` renders the Dashboard with an empty feature list and the workspace selector visible. No error page.
- **StandaloneReviewPage**: Only mounted at `/` when `FLAGS.DEV_WORKFLOW` is false. It uses `?source=` and `?worktree=` query params which are unaffected.
- **FeatureNavBar active tab detection**: Both link generation (`basePath`) and `pathname.startsWith(basePath)` matching must use the workspace-prefixed path.
- **FeatureRow in "All workspaces" mode**: Uses `feature.repoName` (server-provided) to build the workspace path, not the current URL's workspace. This ensures clicking a feature from the aggregate view navigates to the correct workspace-scoped URL.

## Review Summary

Artifacts reviewed by `[codex]` codereviewer. Findings addressed:

- `[codex]` useFeaturesContext must read workspace from path params, not just search params
- `[codex]` repo/workspace naming consolidated — all `repo` references removed per user decision
- Legacy redirect support removed per user decision (simplifies architecture)
