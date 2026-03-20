# Spec: Thread Status Redesign

**Feature ID:** 2026-03-20-thread-status-redesign
**Schema:** feature-rapid
**Date:** 2026-03-20

## Motivation

The current thread system has a binary open/resolved toggle that undersells the review workflow. Reviewers need to express richer intent: "this is not worth fixing" (won't fix) and "the code changed, this comment no longer applies" (outdated). GitHub's review UI handles this with a multi-status system plus collapse/expand behavior that keeps resolved noise out of the way while preserving context. Adopting these patterns will make the review experience more expressive and less cluttered.

## Requirements

### R1: Expanded Thread Status Enum

Replace the current three-value `ThreadStatus` (`open | resolved | approved`) with four values:

| Status     | Meaning                                   | Color token                     |
| ---------- | ----------------------------------------- | ------------------------------- |
| `open`     | Active, needs attention                   | amber (`--accent-amber`)        |
| `resolved` | Addressed, verified by reviewer           | emerald (`--accent-emerald`)    |
| `wontfix`  | Acknowledged but intentionally not fixing | muted grey (`--text-muted`)     |
| `outdated` | No longer applicable (code changed)       | purple (`--accent-purple`, new) |

The `approved` status is **deprecated and aliased to `resolved`**. Any existing session data with `status: "approved"` must be treated identically to `"resolved"` at read time. No migration rewrite is needed -- the alias is handled in code.

**Outdated detection model**: The codebase already has a heuristic auto-detection mechanism (`isThreadOutdated()` in `diffUtils.ts`) that compares `thread.anchorContent` against the current diff line content. This coexists with the manual `status: "outdated"`:

- **Auto-detected outdated**: `isThreadOutdated()` returns true → thread is visually treated as outdated (badge, dimming) regardless of `thread.status`. This is a computed UI property, not a persisted status.
- **Manual outdated**: User sets `status: "outdated"` via dropdown/keyboard for cases the heuristic misses (e.g., semantic changes where the line text hasn't changed).
- **Either condition**: A thread is considered "outdated" for display purposes if EITHER `status === "outdated"` OR `isThreadOutdated()` returns true.
- **DiffThreadNav grouping**: The "Outdated" section includes both manually-outdated and auto-detected-outdated threads.
- **OverviewTab**: The existing `outdatedThreadIds` set and `overviewFilter` type must be updated to also include manually-outdated threads.

### R2: Collapse/Expand for Non-Open Threads (DiffInlineThread)

Threads with status `resolved`, `wontfix`, or `outdated` render in a **collapsed single-line summary bar** inside the diff view. The summary bar shows:

- Status icon (colored circle or checkmark matching the status)
- Author name of the first message
- Truncated first-message preview (max ~80 chars, plain text extracted from markdown)
- "Show conversation" link/button on the right

Clicking the summary bar or the link **expands** the thread to its full form (messages, reply box, status actions). Clicking a "Hide" button or the summary bar again **collapses** it. Open threads always render expanded and cannot be collapsed.

Collapse state is **local UI state only** -- not persisted to the session file. On page load, non-open threads start collapsed. When a thread's status transitions to a non-open state, the thread auto-collapses (matching GitHub's behavior where resolving a conversation automatically hides it).

**Note on collapse axes**: The nav panel sections (R5) and inline diff threads have independent collapse states. Nav sections start expanded so users can see all thread metadata at a glance; inline threads start collapsed to reduce diff clutter.

### R3: Status Badge Component

A small pill-shaped `ThreadStatusBadge` component renders the thread status with:

- Colored dot or icon matching the status color
- Status label text: "Open", "Resolved", "Won't Fix", "Outdated"
- Background tint using the status color's dim variant

Used in:

- DiffInlineThread header row (next to author name)
- DiffThreadNav cards (replacing the raw `●` dot)
- [ASSUMPTION] Not used in VS Code -- VS Code has its own native state rendering

### R4: Status Dropdown Selector

Replace the simple Resolve/Reopen button in `DiffInlineThread` with a split-button pattern:

- **Primary action button**: The most common transition for the current state
  - When `open` -> primary button is "Resolve" (green)
  - When `resolved`/`wontfix`/`outdated` -> primary button is "Reopen" (amber)
- **Dropdown chevron**: Opens a popover with all valid transitions:
  - From `open`: Resolve, Won't Fix, Mark Outdated
  - From `resolved`: Reopen
  - From `wontfix`: Reopen, Resolve
  - From `outdated`: Reopen, Resolve

The dropdown uses the existing `Popover` component from `apps/ui/src/components/ui/popover.tsx` (Radix-based). Each option shows the status icon + label.

### R5: DiffThreadNav Grouping Updates

The nav panel currently groups threads into "Open" and "Resolved" sections. Update to:

| Section   | Filter                                                       | Badge color |
| --------- | ------------------------------------------------------------ | ----------- |
| Open      | `status === "open"`                                          | amber       |
| Resolved  | `status === "resolved" \|\| status === "approved"`           | emerald     |
| Won't Fix | `status === "wontfix"`                                       | muted       |
| Outdated  | `status === "outdated"` OR `isThreadOutdated()` returns true | purple      |

Non-open sections are **collapsible** (click the section header to toggle via `SectionLabel`'s new `onClick` prop). Sections with zero threads are hidden entirely.

The `SectionLabel` component's `variant` prop expands from `"open" | "resolved"` to `"open" | "resolved" | "wontfix" | "outdated"`. `SectionLabel` also gains `onClick?: () => void` and `collapsed?: boolean` props for toggle behavior.

### R6: Keyboard Shortcut Updates

Current shortcuts: `r` = resolve, `o` = reopen.

Updated shortcuts:

| Key | Action                        | Condition            |
| --- | ----------------------------- | -------------------- |
| `r` | Set status to `resolved`      | Thread is `open`     |
| `o` | Set status to `open` (reopen) | Thread is not `open` |
| `w` | Set status to `wontfix`       | Thread is `open`     |
| `d` | Set status to `outdated`      | Thread is `open`     |

All shortcuts operate on the currently focused thread (via `j`/`k` navigation).

### R7: VS Code Extension Status Mapping

VS Code's `CommentThreadState` enum only has two values: `Unresolved (0)` and `Resolved (1)`. The mapping:

| Session status | VS Code state  | Collapsible state |
| -------------- | -------------- | ----------------- |
| `open`         | Unresolved (0) | Expanded          |
| `resolved`     | Resolved (1)   | Collapsed\*       |
| `wontfix`      | Resolved (1)   | Collapsed\*       |
| `outdated`     | Resolved (1)   | Collapsed\*       |

\*Exception: threads where the last message is from an agent remain Expanded regardless of status, so the user sees the AI response.

The VS Code resolve/unresolve commands continue to toggle between `open` and `resolved`. The `wontfix` and `outdated` statuses can only be set from the browser UI -- this is acceptable since VS Code's comment API has no mechanism for custom status transitions.

The `SessionThread.status` type in `apps/vscode/src/serverClient.ts` must be updated to include the new values so the extension can read and display them correctly (even if it cannot set them all).

### R8: Server API Compatibility

The server PATCH endpoint (`PATCH /:id/code-session/threads/:threadId`) already accepts any `status` string via the `PatchPayload` interface. The `ThreadStatus` type on the server side (`apps/server/src/routes/sessions.ts`) must be expanded to include `wontfix` and `outdated`.

The `review:resolve-thread-done` broadcast currently fires only when `status === "resolved"`. Update to also fire for `wontfix` and `outdated` so the sidebar progress tracking recognizes all non-open states as "done".

### R9: CSS Variable Additions

Add new CSS variables for the `outdated` status and the purple accent:

```css
--accent-purple: #a78bfa;
--accent-purple-dim: rgba(167, 139, 250, 0.15);

--status-wontfix: var(--text-muted);
--status-wontfix-bg: rgba(72, 79, 88, 0.2);
--status-outdated: var(--accent-purple);
--status-outdated-bg: rgba(167, 139, 250, 0.2);
```

## Acceptance Criteria

1. Thread status type includes `open`, `resolved`, `wontfix`, `outdated` across UI, server, and VS Code types
2. Existing sessions with `approved` status render as `resolved` without errors
3. Non-open threads in the diff view collapse to a single-line summary bar by default
4. Collapsed threads expand on click and collapse again on click
5. Status badge pill renders correctly for all four statuses with correct colors
6. Status dropdown opens from chevron, shows valid transitions for current status
7. Primary action button shows contextually correct action (Resolve when open, Reopen otherwise)
8. DiffThreadNav shows up to four sections, hides empty ones, each collapsible
9. Keyboard shortcuts `r`, `o`, `w`, `d` update thread status correctly
10. VS Code extension reads all four statuses without errors; maps non-open to Resolved state
11. Server PATCH accepts new statuses; broadcasts completion for all non-open status transitions
12. Auto-detected outdated threads (via `isThreadOutdated()`) appear in the "Outdated" nav section and show the outdated badge
13. `pendingCount`/`resolvedCount` in ReviewPage correctly count all non-open statuses using `isClosed()`
14. `pnpm type-check` passes with no errors
15. `pnpm lint` passes with no errors

## Alternatives Considered

### Keep "approved" as a separate status

Rejected. "Approved" was only used by the AI review agent to indicate agreement, which is semantically identical to "resolved." Keeping it adds a fifth status without clear UX value. Aliasing it to "resolved" is simpler.

### Auto-detect "outdated" status when code changes

Already partially implemented. The existing `isThreadOutdated()` heuristic compares `thread.anchorContent` against the current diff line content. Rather than replacing this with a new status-based approach, we keep both: the heuristic provides auto-detection (visual treatment only), and the manual `status: "outdated"` covers cases the heuristic misses. See R1 for the full model.

### Use a full dropdown menu component (shadcn DropdownMenu)

Rejected. The project does not have a `DropdownMenu` component installed. The existing `Popover` component (Radix-based) is already available and provides the same overlay behavior. Building the status menu as a popover avoids adding a new shadcn dependency.
