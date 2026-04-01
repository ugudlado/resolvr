# Design: Thread Status Redesign

**Feature ID:** 2026-03-20-thread-status-redesign
**Date:** 2026-03-20

## Approach

Extend the existing thread status system in place. No new dependencies. Reuse the Radix `Popover` component for the status dropdown. Handle the `approved` deprecation as a runtime alias rather than a data migration.

## Type Changes

### UI Types (`apps/ui/src/types/constants.ts`)

```typescript
// Before
export const THREAD_STATUS = {
  Open: "open",
  Resolved: "resolved",
  Approved: "approved",
} as const;

// After
export const THREAD_STATUS = {
  Open: "open",
  Resolved: "resolved",
  WontFix: "wontfix",
  Outdated: "outdated",
  /** @deprecated Alias for Resolved. Kept for backward compat with existing session files. */
  Approved: "approved",
} as const;
```

`ThreadStatus` remains the derived union type. The `Approved` key stays in the const object so existing code that references `THREAD_STATUS.Approved` still compiles, but all new code uses `Resolved` instead.

### Approved Alias Helper

Add a utility function used wherever thread status is read:

```typescript
// apps/ui/src/utils/threadStatus.ts (new file)
import { THREAD_STATUS, type ThreadStatus } from "../types/constants";

/** Normalize legacy "approved" status to "resolved". */
export function normalizeStatus(status: ThreadStatus | string): ThreadStatus {
  if (status === THREAD_STATUS.Approved) return THREAD_STATUS.Resolved;
  return status as ThreadStatus;
}

/** Returns true if the thread is in any non-open (closed) state. */
export function isClosed(status: ThreadStatus | string): boolean {
  const s = normalizeStatus(status);
  return s !== THREAD_STATUS.Open;
}
```

This function is called at the boundaries: `DiffInlineThread`, `DiffThreadNav`, `useKeyboardReview`, and `useReviewSession.updateThreadStatus`. It is NOT applied to the persisted data -- session files may still contain `"approved"`.

### Server Types (`apps/server/src/routes/sessions.ts`)

```typescript
export const THREAD_STATUS = {
  Open: "open",
  Resolved: "resolved",
  Approved: "approved",
  WontFix: "wontfix",
  Outdated: "outdated",
} as const;
```

### VS Code Types (`apps/vscode/src/serverClient.ts`)

```typescript
// SessionThread.status changes from:
status: "open" | "resolved" | "approved";
// to:
status: "open" | "resolved" | "approved" | "wontfix" | "outdated";
```

## Component Architecture

### New: `ThreadStatusBadge` (`apps/ui/src/components/shared/ThreadStatusBadge.tsx`)

Small presentational component. Props:

```typescript
interface ThreadStatusBadgeProps {
  status: ThreadStatus;
  size?: "sm" | "md"; // sm for nav cards, md for inline thread header
}
```

Renders a pill: `<span>` with colored dot + label text. Styles use CSS variables via `style` prop (no dynamic Tailwind interpolation). Color mapping:

| Status   | Dot color          | Background             | Label     |
| -------- | ------------------ | ---------------------- | --------- |
| open     | `--accent-amber`   | `--accent-amber-dim`   | Open      |
| resolved | `--accent-emerald` | `--accent-emerald-dim` | Resolved  |
| wontfix  | `--text-muted`     | `--bg-overlay`         | Won't Fix |
| outdated | `--accent-purple`  | `--accent-purple-dim`  | Outdated  |

### New: `ThreadStatusDropdown` (`apps/ui/src/components/shared/ThreadStatusDropdown.tsx`)

Uses `Popover` + `PopoverTrigger` + `PopoverContent` from the existing UI library. Props:

```typescript
interface ThreadStatusDropdownProps {
  currentStatus: ThreadStatus;
  onStatusChange: (status: ThreadStatus) => void;
}
```

Renders:

1. A split-button group:
   - Left: Primary action button (Resolve or Reopen) with direct `onClick`
   - Right: Chevron-down button that opens the Popover
2. Popover content: list of transition options, each with status icon + label

Transition rules (encoded as a static map):

```typescript
const TRANSITIONS: Record<string, ThreadStatus[]> = {
  open: ["resolved", "wontfix", "outdated"],
  resolved: ["open"],
  wontfix: ["open", "resolved"],
  outdated: ["open", "resolved"],
};
```

The primary button always triggers the first item in the transition list. The dropdown shows all items (including the primary, for discoverability).

**Popover sizing**: `ThreadStatusDropdown` passes `className="w-44 p-1"` to `PopoverContent` to override its default `w-72 p-4`, which is too wide for 3 short options.

### Modified: `DiffInlineThread` (`apps/ui/src/components/diff/DiffInlineThread.tsx`)

Changes:

1. **Add collapse state**: `const [collapsed, setCollapsed] = useState(() => isClosed(thread.status))`
2. **Collapsed render path**: When collapsed, render a single-line summary bar instead of the full card:
   ```
   [StatusIcon] AuthorName: "Preview text truncated to ~80 ch..."  [Show conversation]
   ```
   The summary bar has a subtle background matching the status color dim variant, rounded corners, and a left border accent.
3. **Header row**: Add `ThreadStatusBadge` after the author name
4. **Action buttons**: Replace the Resolve/Reopen button with `ThreadStatusDropdown`
5. **Status-driven styles**: Expand the borderColor/bgColor/arrowColor logic to handle `wontfix` and `outdated`:
   - `wontfix`: borderColor = `--text-muted`, bgColor = `--bg-surface`, muted text
   - `outdated`: borderColor = `--accent-purple`, bgColor = `--bg-surface`, slightly muted text

The `onStatusChange` prop type changes from `(threadId: string, status: "open" | "resolved" | "approved")` to `(threadId: string, status: ThreadStatus)`.

When status changes to a non-open value, auto-collapse. When status changes to open, auto-expand. This is handled by a `useEffect` watching `thread.status`.

### Modified: `DiffThreadNav` (`apps/ui/src/components/diff/DiffThreadNav.tsx`)

Changes:

1. **Four section groups**: Replace the two-group (open/resolved) with four groups. Each computed via `useMemo`. Empty groups are omitted from render.
2. **Collapsible sections**: Each non-open section gets a toggle state (local `useState`). Click the `SectionLabel` to collapse/expand the section's thread list. Open section is always visible.
3. **ThreadNavCard**: Replace the `●` status dot with `ThreadStatusBadge` (size="sm"). Update the `dotColor` logic to handle all four statuses.
4. **Filter logic**: The resolved filter now includes `approved` (for backward compat). The outdated filter includes both manual status and auto-detected outdated (via `outdatedThreadIds` prop from `ReviewPage`):
   ```typescript
   const resolvedThreads = threads.filter(
     (t) => normalizeStatus(t.status) === "resolved",
   );
   const wontfixThreads = threads.filter((t) => t.status === "wontfix");
   const outdatedThreads = threads.filter(
     (t) => t.status === "outdated" || outdatedThreadIds.has(t.id),
   );
   ```
   `DiffThreadNav` receives `outdatedThreadIds: Set<string>` as a new prop from `ReviewPage`.

### Modified: `SectionLabel` (`apps/ui/src/components/shared/SectionLabel.tsx`)

Expand `variant` prop to `"open" | "resolved" | "wontfix" | "outdated"`. Add new props for collapsible behavior:

```typescript
interface SectionLabelProps {
  variant: "open" | "resolved" | "wontfix" | "outdated";
  count: number;
  onClick?: () => void; // NEW: toggle handler for collapsible sections
  collapsed?: boolean; // NEW: controls chevron rotation and aria-expanded
}
```

When `onClick` is provided, renders a chevron icon (rotates 90° → 0° on collapse) and applies `cursor-pointer`. Add color mappings:

```typescript
const VARIANT_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "var(--accent-amber-dim)", text: "var(--accent-amber)" },
  resolved: { bg: "var(--accent-emerald-dim)", text: "var(--accent-emerald)" },
  wontfix: { bg: "var(--bg-overlay)", text: "var(--text-muted)" },
  outdated: { bg: "var(--accent-purple-dim)", text: "var(--accent-purple)" },
};
```

### Modified: `useKeyboardReview` (`apps/ui/src/hooks/useKeyboardReview.ts`)

Add two new keyboard handlers inside the `switch` block:

```typescript
case "w": {
  const t = threads[threadIdxRef.current] ?? null;
  if (t?.status === THREAD_STATUS.Open) cbs.onThreadStatusChange(t.id, "wontfix");
  break;
}
case "d": {
  const t = threads[threadIdxRef.current] ?? null;
  if (t?.status === THREAD_STATUS.Open) cbs.onThreadStatusChange(t.id, "outdated");
  break;
}
```

The existing `r` and `o` handlers are updated to use the generalized `onThreadStatusChange` callback instead of separate `onThreadResolve`/`onThreadReopen` callbacks. The `o` handler guard must use `isClosed()` instead of checking specific statuses:

```typescript
case "o": {
  const t = threads[threadIdxRef.current] ?? null;
  if (t && isClosed(t.status)) cbs.onThreadStatusChange(t.id, "open");
  break;
}
```

The hook's options interface changes:

```typescript
// Before
onThreadResolve: (threadId: string) => void;
onThreadReopen: (threadId: string) => void;

// After
onThreadStatusChange: (threadId: string, status: ThreadStatus) => void;
```

This is a breaking change to the hook's API. The consuming component (`ReviewPage`) must adapt its callback wiring — replacing separate `onThreadResolve`/`onThreadReopen` with a single `onThreadStatusChange` callback.

### Modified: `commentManager.ts` (`apps/vscode/src/commentManager.ts`)

Changes:

1. **`_createVSCodeThread`**: Update the collapsed/state logic to handle `wontfix` and `outdated`:
   ```typescript
   const isNonOpen = sessionThread.status !== "open";
   thread.state = isNonOpen ? 1 : 0;
   thread.collapsibleState =
     isNonOpen && !hasAgentReply
       ? vscode.CommentThreadCollapsibleState.Collapsed
       : vscode.CommentThreadCollapsibleState.Expanded;
   ```
2. **Resolve/unresolve commands**: No change needed. They continue to set `resolved`/`open`. Users who want `wontfix`/`outdated` use the browser UI.

### Modified: Server sessions route (`apps/server/src/routes/sessions.ts`)

Changes:

1. **ThreadStatus type**: Add `WontFix` and `Outdated` to the const object
2. **Broadcast logic**: Change the condition for `review:resolve-thread-done` from `status === "resolved"` to `status !== "open"` (all non-open transitions broadcast completion)

## CSS Variable Additions (`apps/ui/src/index.css`)

Add to the `:root` block:

```css
/* Purple accent (for Outdated status) */
--accent-purple: #a78bfa;
--accent-purple-dim: rgba(167, 139, 250, 0.15);

/* Status badges — updated set */
--status-wontfix: var(--text-muted);
--status-wontfix-bg: rgba(72, 79, 88, 0.2);
--status-outdated: var(--accent-purple);
--status-outdated-bg: rgba(167, 139, 250, 0.2);
```

Also add to the `@theme inline` block in the same file:

```css
--color-accent-purple: #a78bfa;
--color-accent-purple-dim: rgba(167, 139, 250, 0.15);
```

## State Management

No Zustand store changes. Thread status lives in the `threads` array managed by `useReviewSession`. The `updateThreadStatus` function already accepts any `ThreadStatus` value -- it just needs the type to widen.

### Modified: `ReviewPage` (`apps/ui/src/pages/ReviewPage.tsx`)

Changes:

1. **Keyboard hook wiring**: Replace `onThreadResolve`/`onThreadReopen` with `onThreadStatusChange: (id, status) => updateThreadStatus(id, status)`
2. **Progress counters**: Use `isClosed()` for the resolved bucket so `wontfix`/`outdated` threads are counted as "done":
   ```typescript
   if (isClosed(t.status)) resolved++;
   else pending++;
   ```
3. **`outdatedThreadIds`**: Continue computing via `isThreadOutdated()` heuristic. Also pass this set to `DiffThreadNav` as a prop.

### Modified: `localReviewApi.ts` (`apps/ui/src/services/localReviewApi.ts`)

The flat `ReviewThread` type has a hardcoded `status: "open" | "resolved" | "approved"`. Widen to use `ThreadStatus` from constants.

### Modified: `OverviewTab` (`apps/ui/src/components/sidebar/OverviewTab.tsx`)

1. **`overviewFilter` type**: Expand from `"all" | "open" | "resolved" | "outdated"` to include `"wontfix"`
2. **Filter logic**: Include manually-outdated threads (`status === "outdated"`) in the outdated filter alongside auto-detected ones
3. **Filter chips**: Add "Won't Fix" chip

### Modified: `diffUtils.ts` (`apps/ui/src/utils/diffUtils.ts`)

No functional changes to `isThreadOutdated()` itself. The heuristic remains as-is. The reconciliation with the new manual `status: "outdated"` happens at the component level (ReviewPage, DiffThreadNav), not in this utility.

Collapse/expand state for `DiffInlineThread` is component-local (`useState`). It resets on unmount (navigating away from the file). This is intentional -- collapsed state is transient UI state, not review data.

Collapse/expand state for `DiffThreadNav` sections is also component-local. All non-open sections start expanded (visible) by default to avoid hiding threads the user hasn't seen yet.

## Migration Path

### Existing session files with `"approved"` status

No file migration. The `normalizeStatus()` helper maps `"approved"` to `"resolved"` at read time. Anywhere the UI checks for resolved status, it goes through `normalizeStatus()` or checks `isClosed()`. When a user interacts with an `approved` thread (e.g., reopens then re-resolves), the new status written back is `"resolved"`, not `"approved"` -- so sessions naturally migrate over time.

### Existing code referencing `THREAD_STATUS.Approved`

The const object keeps the `Approved` key (marked `@deprecated`). TypeScript will still compile. Linting can flag usage via a follow-up cleanup pass, but this is non-blocking.

## Data Flow: Status Change

1. User clicks "Won't Fix" in the `ThreadStatusDropdown` popover
2. `ThreadStatusDropdown` calls `onStatusChange("wontfix")`
3. `DiffInlineThread` calls `props.onStatusChange(thread.id, "wontfix")`
4. `ReviewPage` calls `updateThreadStatus(threadId, "wontfix")` (from `useReviewSession`)
5. `useReviewSession` optimistically updates local state: `thread.status = "wontfix"`
6. Auto-save debounce (200ms) POSTs full session to server
7. Server writes to disk, broadcasts `review:session-updated`
8. VS Code extension receives broadcast, reconciles threads, maps `wontfix` to `CommentThreadState.Resolved`

## Error Handling

- Invalid status values in session files: `normalizeStatus()` passes through unknown strings as-is. The UI will render them with default (blue) styling. No crash.
- Popover dismiss: Clicking outside the status dropdown closes it (Radix default behavior). No special handling needed.
- Race conditions: The optimistic update + debounce pattern is unchanged. If two rapid status changes happen, only the final state is persisted. This is the existing behavior and is acceptable.

## File Summary

| File                                                     | Change type                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/ui/src/types/constants.ts`                         | Modify -- add WontFix, Outdated to THREAD_STATUS                         |
| `apps/ui/src/utils/threadStatus.ts`                      | New -- normalizeStatus, isClosed helpers                                 |
| `apps/ui/src/index.css`                                  | Modify -- add purple accent + status CSS vars                            |
| `apps/ui/src/components/shared/ThreadStatusBadge.tsx`    | New -- status pill component                                             |
| `apps/ui/src/components/shared/ThreadStatusDropdown.tsx` | New -- split-button + popover                                            |
| `apps/ui/src/components/shared/SectionLabel.tsx`         | Modify -- expand variant prop                                            |
| `apps/ui/src/components/diff/DiffInlineThread.tsx`       | Modify -- collapse, badge, dropdown                                      |
| `apps/ui/src/components/diff/DiffThreadNav.tsx`          | Modify -- four sections, badge                                           |
| `apps/ui/src/hooks/useKeyboardReview.ts`                 | Modify -- add w/d shortcuts, unify callback                              |
| `apps/ui/src/hooks/useReviewSession.ts`                  | Minimal -- type already generic enough                                   |
| `apps/ui/src/pages/ReviewPage.tsx`                       | Modify -- keyboard hook wiring, progress counters, outdated prop passing |
| `apps/ui/src/services/localReviewApi.ts`                 | Modify -- widen flat ReviewThread status type                            |
| `apps/ui/src/components/sidebar/OverviewTab.tsx`         | Modify -- add wontfix filter, reconcile outdated                         |
| `apps/server/src/routes/sessions.ts`                     | Modify -- expand ThreadStatus, broadcast logic                           |
| `apps/vscode/src/serverClient.ts`                        | Modify -- expand status union                                            |
| `apps/vscode/src/commentManager.ts`                      | Modify -- handle new statuses in state mapping                           |
