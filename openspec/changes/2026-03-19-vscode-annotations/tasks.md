# Tasks: VS Code Annotation Integration

## Phase 1: Extension Scaffold + Server Connection

### T-1: Initialize VS Code extension package in monorepo

**Why**: The extension needs a proper VS Code extension manifest, TypeScript configuration, and build tooling before any feature code can be written. Setting this up as a pnpm workspace ensures it integrates with the existing monorepo.

**Files**:

- `apps/vscode/package.json` -- Extension manifest with activation events (`workspaceContains:.review/`, `onStartupFinished`, `onCommand:local-review.*`), contributes (commands, configuration), VS Code engine version, main entry point
- `apps/vscode/tsconfig.json` -- TypeScript config targeting ES2020, importing `@vscode/types`
- `apps/vscode/esbuild.config.mjs` -- esbuild bundler config (external: `vscode`)
- `apps/vscode/src/extension.ts` -- Minimal activate/deactivate stubs
- `pnpm-workspace.yaml` -- Add `apps/vscode` to workspace list

**Verify**:

- `pnpm install` succeeds with the new workspace
- `pnpm -C apps/vscode build` produces `dist/extension.js`
- Extension can be loaded in VS Code Extension Development Host via F5

---

### T-2: Implement feature detection from git branch

**Why**: The extension needs to know which feature's review session to load. The convention is `feature/{feature-id}` branch names. This is the prerequisite for all server communication.

**Files**:

- `apps/vscode/src/featureDetector.ts` -- Parse current git branch via `git rev-parse --abbrev-ref HEAD`, extract feature ID from `feature/(.+)` pattern, expose `getFeatureId(): Promise<string | null>`, watch `.git/HEAD` file for branch changes (more reliable than git extension internal API)

**Verify**:

- On a `feature/test-feature` branch, `getFeatureId()` returns `"test-feature"`
- On `main` branch, returns `null`
- Extension shows "No active feature" in status bar when on non-feature branch

---

### T-3: Implement REST client and connection status

**Why**: All thread operations go through the local-review REST API. The status bar indicator gives users confidence about connectivity.

**Files**:

- `apps/vscode/src/serverClient.ts` -- REST client wrapping fetch: `getSession(featureId)`, `createThread(featureId, thread)`, `updateThread(featureId, threadId, patch)`, `getThreads(featureId)`. Configurable base URL from `local-review.serverUrl` setting
- `apps/vscode/src/statusBar.ts` -- VS Code StatusBarItem showing "Local Review: Connected/Disconnected/No Feature"
- `apps/vscode/src/extension.ts` -- Wire up feature detection, server client, and status bar on activation

**Verify**:

- With server running, status bar shows "Local Review: Connected"
- With server stopped, status bar shows "Local Review: Disconnected" (no error dialogs)
- `serverClient.getSession()` returns session data for a valid feature

---

## Phase 2: Read-Only Thread Display

### T-4: Implement CommentController and thread rendering

**Why**: R1 -- users need to see existing review threads as inline VS Code comments. This is the core value proposition of the extension.

**Files**:

- `apps/vscode/src/commentManager.ts` -- Create `CommentController` with ID `local-review`, implement `loadThreads(session)` that creates `CommentThread` for each open thread with proper URI, range, and comments
- `apps/vscode/src/threadMapper.ts` -- Bidirectional map between session thread IDs and VS Code CommentThread objects, `register()`, `getSessionId()`, `getVSCodeThread()`, `clear()`
- `apps/vscode/src/types.ts` -- Shared types: `ReviewThread`, `ReviewMessage`, `DiffLineAnchor` (aligned with server types)

**Verify**:

- Open a worktree with an existing code review session
- VS Code shows comment indicators on the correct files and lines
- Expanding a thread shows all messages with author and body
- Resolved threads appear collapsed
- Line numbers are correctly translated (no off-by-one errors)

---

## Phase 3: Create New Comments

### T-5: Implement comment creation from VS Code

**Why**: R2 -- users need to add new review threads directly from the editor. This requires the CommentController's `commentingRangeProvider` and a handler for new thread creation.

**Files**:

- `apps/vscode/src/commentManager.ts` -- Add `commentingRangeProvider` (all lines in tracked files), implement `onDidCreateThread` handler that builds a `ReviewThread` from the VS Code range and comment text, calls `serverClient.createThread()`
- `apps/vscode/src/serverClient.ts` -- Add `createThread()` method calling `POST /api/features/:id/code-session/threads`

**Verify**:

- Click "+" gutter icon on any line in a worktree file
- Type a comment and submit
- Thread appears in VS Code immediately
- Thread appears in browser UI within 1 second (requires server endpoint from T-9)

---

## Phase 4: Reply and Resolve Threads

### T-6: Implement reply and resolve actions

**Why**: R3 -- users need to participate in thread discussions and mark issues as resolved without switching to the browser.

**Files**:

- `apps/vscode/src/commentManager.ts` -- Implement `onDidCreateComment` handler (reply to existing thread), implement resolve/unresolve command handlers. Map VS Code's "Mark as Resolved" action to PATCH thread status
- `apps/vscode/src/extension.ts` -- Register resolve/unresolve commands

**Verify**:

- Reply to an existing thread in VS Code, reply appears in browser UI
- Click "Resolve" on a thread, thread status changes to resolved in browser UI
- Unresolve a resolved thread, status reverts to open in browser UI

---

### T-6c: Request Changes + Approve commands (replicate browser UI verdict flow)

**Why**: R7 -- users need the same "Request Changes" / "Approve" flow as the browser UI. "Request Changes" sets verdict AND triggers the resolver agent. "Approve" sets verdict to approved.

**Files**:

- `apps/vscode/src/commands/reviewActions.ts` -- Command handlers: `local-review.requestChanges` (set verdict + trigger resolver via POST /api/resolver/resolve), `local-review.approve` (set verdict to approved)
- `apps/vscode/src/serverClient.ts` -- Add `setVerdict(featureId, verdict)` method calling `PATCH /api/features/:id/code-session`, add `triggerResolve(featureId, sessionType)` method calling `POST /api/resolver/resolve`
- `apps/vscode/src/statusBar.ts` -- Add "Request Changes" and "Approve" buttons alongside connection indicator. Show resolver progress during resolution ("Resolving 3/7 threads..."). Show verdict state ("✓ Approved" / "✗ Changes Requested"). Listen for WebSocket resolve events (resolve-started, resolve-thread-done, resolve-completed, resolve-failed).
- `apps/vscode/src/extension.ts` -- Register both commands

**Verify**:

- Click "Request Changes" → verdict set AND resolver triggered, progress shows in status bar
- Resolver completes → status bar shows "✓ N resolved", threads updated in editor
- Click "Approve" → status bar shows "✓ Approved — Ready to merge", browser UI reflects
- Run both from command palette → same behavior
- Verdict persists across extension reload (loaded from session on activation)
- Resolver failure → status bar shows error, no crash

---

### T-6d: Agent reply loop — full back-and-forth from VS Code

**Why**: R8 -- after the resolver agent processes threads, users continue the review entirely from VS Code: read agent responses, reply, re-open threads, then re-trigger resolve for another round.

**Files**:

- `apps/vscode/src/commentManager.ts` -- Ensure agent-resolved threads display agent messages with clear author attribution ("claude" / "resolver"). Add "Re-open" action to resolved threads (unresolve command). Ensure onDidCreateComment works on resolved threads to allow replies.
- `apps/vscode/src/threadMapper.ts` -- reconcile() must preserve thread expansion state for threads with new agent messages (don't collapse a thread that just got an agent reply — user needs to read it)
- `apps/vscode/src/statusBar.ts` -- After resolver completes and user has open threads, show "Re-resolve N threads" button (like the browser UI's re-resolve button)

**Verify**:

- "Request Changes" → resolver runs → threads resolve → agent messages visible in VS Code
- Reply to an agent-resolved thread → message appears in browser UI
- Re-open a resolved thread → status changes to "open" in browser UI
- "Request Changes" again → second resolver round runs, processes re-opened threads
- Multiple rounds: request changes → reply → request changes → approve works end-to-end
- Browser UI and VS Code stay in sync throughout the entire loop

---

## Phase 4b: Branch Switch Handling

### T-6b: Handle branch/worktree switching

**Why**: R5 -- when the user switches from one feature branch to another, the extension must dispose all current threads and reload the new session. Without this, stale threads from the previous feature remain visible.

**Files**:

- `apps/vscode/src/featureDetector.ts` -- Listen for `git.onDidChangeState` (VS Code Git extension API) and `vscode.workspace.onDidChangeWorkspaceFolders`. Emit `onFeatureChanged` event with new feature ID (or null).
- `apps/vscode/src/extension.ts` -- Wire `onFeatureChanged` to dispose CommentController + WebSocket, then re-initialize with new feature

**Verify**:

- Switch from `feature/foo` to `feature/bar` — old threads disappear, new threads load
- Switch to `main` — all threads disappear, status bar shows "No active feature"
- Switch back to `feature/foo` — threads reload correctly

---

## Phase 5: Real-Time Bidirectional Sync

### T-7: Implement WebSocket client with auto-reconnect

**Why**: R4 -- changes made in the browser UI must appear in VS Code automatically, without manual refresh.

**Files**:

- `apps/vscode/src/wsClient.ts` -- WebSocket client connecting to `ws://localhost:{port}/ws`, event handler registration (`on(event, handler)`), auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s), connection state tracking
- `apps/vscode/src/extension.ts` -- Wire WebSocket client to comment manager

**Verify**:

- Extension connects to WebSocket on activation
- `wsClient.on('review:session-updated', handler)` receives events
- After server restart, extension reconnects automatically within 30 seconds
- Status bar updates on connect/disconnect transitions

---

### T-8: Implement thread reconciliation on sync events

**Why**: When the browser UI creates or updates threads, the extension must reflect those changes in the VS Code comment widgets.

**Files**:

- `apps/vscode/src/threadMapper.ts` -- Implement `reconcile(newThreads)` method: dispose all current VS Code CommentThreads, recreate from fresh server data
- `apps/vscode/src/commentManager.ts` -- Connect WebSocket `review:session-updated` event to reconciliation: extract featureId from `data.fileName` (strip `-code.json`), skip events for other features, call `threadMapper.reconcile()`, implement echo deduplication (500ms mute window), update status bar with thread count

**Verify**:

- Create a thread in browser UI, it appears in VS Code within 1 second
- Resolve a thread in browser UI, it collapses in VS Code
- Add a reply in browser UI, the new message appears in the VS Code thread
- Create a thread in VS Code, it appears in VS Code (round-trip via server)

---

## Phase 6: Server-Side Enhancements

### T-9: Add POST endpoint for individual thread creation

**Why**: R6 -- the current API only supports overwriting the entire session (POST code-session) or updating an existing thread (PATCH). Creating a single thread atomically prevents race conditions when VS Code and browser create threads simultaneously.

**Files**:

- `apps/server/src/routes/sessions.ts` -- Add `POST /api/features/:id/code-session/threads` route: read session, append thread, write session, broadcast WebSocket event. Routes go in sessions.ts (not features.ts) because broadcast function is already available here
- `apps/server/src/routes/sessions.ts` -- Add `GET /api/features/:id/code-session/threads` route: return `{ threads: ReviewThread[] }` (lightweight payload for extension sync)
- `apps/server/src/routes/sessions.ts` -- Fix existing PATCH handler to broadcast `SESSION_UPDATED` on ALL updates (not just resolve). Currently only broadcasts `resolve-thread-done` when status becomes "resolved", meaning VS Code replies don't trigger browser UI updates

**Verify**:

- `curl -X POST localhost:37003/api/features/test/code-session/threads -H 'Content-Type: application/json' -d '{"id":"t1","anchor":{...},"status":"open","messages":[]}'` returns 201
- Session file on disk contains the new thread
- Browser UI shows the new thread via WebSocket broadcast
- `curl localhost:37003/api/features/test/code-session/threads` returns threads array only
- Concurrent thread creation from two clients does not lose data (both threads present)

---

### T-10: Rebuild server bundle

**Why**: The server dist must be updated after adding new endpoints, since the plugin uses the bundled `dist/index.js` at runtime.

**Files**:

- `apps/server/dist/index.js` -- Rebuilt via `pnpm -C apps/server build`

**Verify**:

- `pnpm -C apps/server build` succeeds
- `pnpm start` serves the new endpoints correctly
- Existing endpoints continue to work (no regressions)
