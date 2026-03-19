# Specification: VS Code Annotation Integration

## Motivation

The local-review plugin currently requires users to switch to a browser tab at `localhost:37003` to view code review threads, reply to comments, or resolve issues. This context switch breaks the development flow -- a developer reading code in VS Code must open a separate window, navigate to the correct file, and find the relevant line to see or respond to review comments.

VS Code has a stable CommentController API (since v1.44) designed specifically for inline code annotations. GitHub Pull Requests, GitLens, and similar extensions use it to display review comments directly alongside code. By building a VS Code extension that connects to the local-review server, users can view, create, and resolve review threads without leaving their editor.

The local-review server already provides REST endpoints for session CRUD and WebSocket events for real-time sync. The browser UI already reacts to external session changes (via file watcher broadcasts). This means a VS Code extension can participate as a first-class client with minimal server-side changes.

## Requirements

### R1: Display existing review threads as VS Code comments

The extension reads the current feature's code-session from the local-review server and renders all `ReviewThread` objects with `side: "new"` anchors as VS Code CommentThreads at the correct file and line range. Open threads are expanded; resolved threads are collapsed. Thread messages appear as individual `Comment` objects with author name, timestamp, and severity badge.

### R2: Create new review threads from VS Code

Users can select a line or range in any file within the feature worktree and add a new comment. The extension creates a new thread via the local-review server API, which then broadcasts the change to the browser UI via WebSocket.

### R3: Reply to and resolve existing threads from VS Code

Users can add reply messages to existing threads and change thread status to "resolved" directly from the VS Code comment widget. Status changes propagate to the server and then to the browser UI.

### R4: Real-time bidirectional sync via WebSocket

When the browser UI creates, updates, or resolves a thread, the VS Code extension receives the change via WebSocket and updates inline comments without requiring a manual refresh. Likewise, changes made in VS Code are reflected in the browser UI in real time.

### R5: Automatic feature detection from git branch

The extension detects the active feature ID by reading the current git branch name (convention: `feature/{feature-id}`). When the user switches branches or opens a different worktree, the extension automatically loads the appropriate review session.

### R6: Server endpoint for granular thread operations

Add a POST endpoint for creating individual threads (currently, adding a new thread requires overwriting the entire session via POST). This avoids race conditions when both VS Code and browser create threads simultaneously.

### R7: Request Changes + Approve from VS Code (replicate browser UI flow)

The extension replicates the browser UI's review verdict flow:

1. **"Request Changes"** — sets verdict to `changes_requested` AND triggers the resolver agent via `POST /api/resolver/resolve`. The extension shows resolver progress (resolving N/M threads) in the status bar, just like the browser UI shows a progress bar + per-thread log.
2. **"Approve"** — sets verdict to `approved`, indicating the review is complete.
3. Both actions accessible via command palette AND status bar buttons.

This is the same flow as the browser UI's `ReviewVerdict` component — not a new UX, a port of the existing one.

### R8: Agent reply loop — full back-and-forth from VS Code

After the resolver agent processes threads, the user can continue the review entirely from VS Code:

1. Agent-resolved threads update in real time via WebSocket (agent messages appear as new comments)
2. User can **reply** to agent responses (e.g., "that fix doesn't handle the edge case")
3. User can **re-open** resolved threads that need more work
4. User can **re-trigger resolve** ("Request Changes" again) to start another round
5. This back-and-forth continues until the user is satisfied and clicks "Approve"

The extension does NOT need to leave VS Code for any part of this loop — it triggers the resolver via the same REST endpoint the browser uses.

## Non-Functional Requirements

### NF1: Low latency sync

Thread changes should appear in the other client (VS Code or browser) within 500ms under normal conditions.

### NF2: Graceful degradation

If the local-review server is not running, the extension should show a status bar indicator ("Local Review: Disconnected") and silently retry connection. It must not throw errors or block VS Code startup.

### NF3: Minimal resource footprint

The extension activates on `workspaceContains:.review/` or `onStartupFinished`, then performs a cheap git branch check. If no `feature/*` branch is detected, the extension goes dormant (no CommentController, no WebSocket, no status bar) and re-checks on branch change events. No background activity for non-review workspaces.

### NF4: Extension lives within the local-review monorepo

The extension source code lives in `apps/vscode/` as a new workspace in the pnpm monorepo. This keeps it tightly coupled to the server types and allows sharing TypeScript type definitions.

## User Stories

### US1: Reviewing code in the editor

A developer opens a feature worktree in VS Code. The extension detects the `feature/2026-03-19-some-feature` branch, connects to the local-review server, and loads review threads. The developer sees purple comment indicators on lines 42-45 of `src/utils/parser.ts` with a critical thread: "This regex can catastrophic backtrack on untrusted input." They click to expand, read the full discussion, and type a reply: "Fixed in the next commit, switched to a linear-time parser." They mark the thread as resolved.

### US2: Starting a review from VS Code

A reviewer opens the worktree, right-clicks on line 78 of `src/api/handler.ts`, and selects "Add Review Comment." They type: "Missing error handling for the 404 case" and set severity to "improvement." The thread immediately appears in the browser UI for other reviewers.

### US3: Parallel review sessions

One reviewer uses the browser UI while another uses VS Code. Both see each other's comments appear in real time. When the VS Code user resolves a thread, the browser UI shows it as resolved within a second.

## Out of Scope

- **Spec review annotations**: This feature covers code review threads only (DiffLineAnchor), not spec block annotations (SpecBlockAnchor). Spec annotations remain browser-only.
- **VS Code Marketplace publishing**: Initial version is installed locally from the monorepo. Marketplace packaging is a future concern.
- **Review verdict setting**: Setting the overall review verdict (approved / changes_requested) remains browser-only. The extension handles individual threads only.
- **Diff view integration**: The extension shows comments on the working tree file, not in a side-by-side diff view. VS Code's built-in SCM diff could be a future enhancement.
- **Old-side anchors**: Threads anchored to `side: "old"` (deleted lines, pre-change code) are skipped in VS Code with a warning logged. These remain visible only in the browser diff view.
- **Resolver progress log in VS Code**: The browser UI shows a detailed per-thread resolve log (ResolveRunLog). For MVP, the VS Code extension shows a summary progress indicator in the status bar (e.g., "Resolving 3/7 threads") rather than a full log panel.
- **Authentication/multi-user**: The local-review server has no auth. Single-user, localhost-only operation.

## Success Criteria

1. A user can open a feature worktree in VS Code and see all open review threads as inline comments within 2 seconds of activation.
2. A user can create a new review thread from VS Code and see it appear in the browser UI within 1 second.
3. A user can reply to and resolve threads from VS Code, with changes reflected in the browser UI in real time.
4. The extension reconnects automatically after a server restart without user intervention.
5. The extension does not activate or consume resources in workspaces without an active review session.
