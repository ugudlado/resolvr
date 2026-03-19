# Design: VS Code Annotation Integration

## Architecture Overview

```
+------------------+       REST / WS        +------------------+       File Watch      +------------------+
|   VS Code Ext    | <-------------------->  | local-review     | <------------------> |   Browser UI      |
|   (apps/vscode)  |    localhost:37003      |   Server         |    .review/sessions  |   (apps/ui)       |
+------------------+                         +------------------+                       +------------------+
        |                                           |
        | CommentController API                     | chokidar file watcher
        v                                           v
  [ VS Code Editor ]                     [ Session JSON files ]
```

The extension is a standard VS Code client that communicates with the same local-review server the browser UI uses. No new server infrastructure is needed -- only targeted endpoint additions for granular thread creation.

The sync model is hub-and-spoke: the server is the source of truth. Both VS Code and browser write to the server, and the server broadcasts changes to all connected WebSocket clients. The existing file watcher already handles this for the browser; the WebSocket client in the extension receives the same events.

## Extension Structure

### Package: `apps/vscode/`

```
apps/vscode/
  package.json          -- Extension manifest, activation events, contributes
  tsconfig.json         -- Extends root tsconfig, targets ES2020
  src/
    extension.ts        -- activate() / deactivate() entry point
    featureDetector.ts  -- Git branch parsing, feature ID resolution
    serverClient.ts     -- REST client for local-review API
    wsClient.ts         -- WebSocket client with auto-reconnect
    commentManager.ts   -- CommentController setup, thread lifecycle
    threadMapper.ts     -- Bidirectional mapping: session threads <-> VS Code CommentThreads
    types.ts            -- Shared types (re-exported from server where possible)
    statusBar.ts        -- Connection status indicator
  esbuild.config.mjs    -- Bundle for distribution
```

### Activation Strategy

The extension activates on three conditions (OR):
1. `workspaceContains:.review/` -- the workspace has a review session directory
2. `onStartupFinished` -- lightweight fallback for worktrees without `.review/` yet
3. `onCommand:local-review.refresh`, `onCommand:local-review.connect`, `onCommand:local-review.disconnect` -- user explicitly invokes a command (each listed individually; wildcard activation events are not valid VS Code API)

On activation:
1. `featureDetector` reads `git rev-parse --abbrev-ref HEAD` and extracts the feature ID from `feature/(.+)` pattern
2. If no feature branch detected, go dormant: no CommentController, no WebSocket, no status bar. Watch `.git/HEAD` file for branch changes (more reliable than `git.onDidChangeState` which is an unstable internal API)
3. If feature ID found, `serverClient` fetches the code session from `GET /api/features/{id}/code-session`
4. `commentManager` creates a `CommentController` and renders all open threads
5. `wsClient` connects to `ws://localhost:37003/ws` for real-time updates

### Deactivation

On deactivate, dispose the CommentController, close the WebSocket connection, and clear all thread mappings.

## Data Flow

### Viewing Threads (Read)

```
1. Extension activates
2. featureDetector.getFeatureId() -> "2026-03-19-some-feature"
3. serverClient.getSession(featureId) -> { threads: ReviewThread[] }
4. For each thread (all statuses):
   a. Skip threads where anchor.side === "old" (log warning: "Skipping old-side thread {id}")
   b. threadMapper.toVSCodeThread(thread) converts:
      - thread.anchor.path -> vscode.Uri.file(worktreePath + "/" + path)
      - thread.anchor.line (1-based) -> vscode.Range(line-1, 0, lineEnd-1, 0) (0-based)
      - thread.messages -> vscode.Comment[] with author, body, timestamp
   b. commentManager.createThread(uri, range, comments)
   c. threadMapper.register(thread.id, vsCodeThread)
```

### Creating New Comments (Write)

```
1. User selects line range in editor, clicks "+" or runs "Add Review Comment" command
2. VS Code shows comment input widget (via CommentController.commentingRangeProvider)
3. User types comment and submits
4. commentManager.onDidCreateThread callback fires with:
   - uri, range, comment text
5. Extension builds a new ReviewThread:
   - id: crypto.randomUUID()
   - anchor: { type: "diff-line", path: relativePath, line: range.start.line + 1, side: "new", hash: sha256(lineContent).slice(0,8), preview: lineContent.slice(0,80) }
   - messages: [{ id: uuid, authorType: "human", author: "vscode-user", text: text, createdAt: now }]
   - status: "open", severity: userSelection or "improvement" default
6. serverClient.createThread(featureId, thread) -> POST /api/features/{id}/code-session/threads
7. Server saves to session file, broadcasts WebSocket event
8. threadMapper.register(thread.id, vsCodeThread)
```

### Resolving Threads (Update)

```
1. User clicks "Resolve" button on a VS Code comment thread
2. commentManager.onDidResolveThread callback fires
3. threadMapper.getSessionId(vsCodeThread) -> threadId
4. serverClient.updateThread(featureId, threadId, { status: "resolved" })
   -> PATCH /api/features/{id}/code-session/threads/{threadId}
5. Server updates session, broadcasts WebSocket event
6. VS Code thread state updates to collapsed/resolved
```

### Replying to Threads (Update)

```
1. User types reply in existing thread widget and submits
2. commentManager.onDidCreateComment callback fires with thread + new comment
3. threadMapper.getSessionId(vsCodeThread) -> threadId
4. serverClient.updateThread(featureId, threadId, {
     messages: [{ id: uuid, authorType: "human", author: "vscode-user", text: text, createdAt: now }]
   })
   -> PATCH /api/features/{id}/code-session/threads/{threadId}
5. Server appends message, broadcasts event
```

### End Review Session (Verdict)

```
1. User clicks status bar "End Review" button OR runs "Local Review: End Session" from command palette
2. VS Code shows QuickPick: "Approve" | "Request Changes"
3. User selects verdict
4. serverClient.setVerdict(featureId, verdict)
   -> PATCH /api/features/{id}/code-session { verdict: "approved" | "changes_requested" }
5. Server updates session, broadcasts WebSocket event
6. Status bar updates to show verdict state (e.g. "✓ Approved" or "✗ Changes Requested")
7. Browser UI reflects verdict change
```

### Agent Reply Loop (Continue After Resolve)

```
1. User triggers resolver agent from CLI (outside VS Code)
2. Agent processes open threads — resolves some, adds reply messages
3. Server writes updated session to disk
4. chokidar detects change, broadcasts "review:session-updated" via WebSocket
5. VS Code extension receives event, threadMapper.reconcile() runs
6. Resolved threads collapse, new agent messages appear in thread widgets
7. User reads agent response, can:
   a. Reply to agent (onDidCreateComment → PATCH with new message)
   b. Re-open resolved thread (unresolve → PATCH status: "open")
   c. Accept resolution (leave as resolved)
8. If user re-opens threads or adds replies, they can request a new resolve round from CLI
```

The key insight: the extension does NOT trigger the resolver agent — it just stays reactive to session changes. The agent writes to the same session JSON, so the existing WebSocket sync handles the round-trip transparently.

### Real-Time Sync (WebSocket)

```
1. wsClient connects to ws://localhost:37003/ws
2. On "review:session-updated" event (payload: `{ fileName: string, session: object }`):
   a. Extract featureId from `fileName` (strip `-code.json` suffix); skip if not the active feature
   b. Parse session data from `data.session`
   c. Diff against current threadMapper state:
      - New threads: create VS Code CommentThread
      - Removed threads: dispose VS Code CommentThread
      - Updated threads: update comments/status in place
   c. threadMapper.reconcile(newThreads)
3. On WebSocket disconnect:
   a. statusBar.show("Local Review: Disconnected")
   b. Exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s)
4. On reconnect:
   a. Fetch full session via REST (catch up on missed events)
   b. statusBar.show("Local Review: Connected")
```

## Feature Detection

The extension determines the active feature ID by:

1. Run `git rev-parse --abbrev-ref HEAD` in the workspace root
2. Match against pattern `feature/(.+)` -- extract the capture group as feature ID
3. If no match, check for `worktreePath` in any session file [ASSUMPTION: not needed for MVP -- branch convention is sufficient]
4. Listen for `vscode.workspace.onDidChangeConfiguration` and `git.onDidChangeState` (from VS Code Git extension API) to detect branch switches

When the feature ID changes:
- Dispose all current CommentThreads
- Disconnect WebSocket (if feature-scoped)
- Reconnect and load new session

## Server-Side Enhancements

### New Endpoint: POST /api/features/:id/code-session/threads

Creates a single thread in the session without overwriting the entire session. This prevents race conditions when VS Code and browser create threads simultaneously.

**Request body**: A single `ReviewThread` object
**Response**: `201 Created` with the created thread
**Behavior**:
1. Read current session from disk
2. Append the new thread to `session.threads`
3. Update `session.metadata.updatedAt`
4. Write session back to disk
5. Broadcast `review:session-updated` WebSocket event

### New Endpoint: GET /api/features/:id/code-session/threads

Returns only the threads array from the session, without the full session envelope. Lighter payload for the extension which only needs thread data for reconciliation.

**Response**: `{ threads: ReviewThread[] }`

[ASSUMPTION: The existing `PATCH /api/features/:id/code-session/threads/:threadId` endpoint is sufficient for updating individual threads. No changes needed there.]

## Thread ID Mapping

The `threadMapper` module maintains a bidirectional map:

```typescript
class ThreadMapper {
  private sessionToVSCode = new Map<string, vscode.CommentThread>();
  private vsCodeToSession = new Map<vscode.CommentThread, string>();

  register(sessionId: string, thread: vscode.CommentThread): void;
  getVSCodeThread(sessionId: string): vscode.CommentThread | undefined;
  getSessionId(thread: vscode.CommentThread): string | undefined;
  dispose(sessionId: string): void;
  reconcile(newThreads: ReviewThread[]): void; // diff + update
  clear(): void; // dispose all
}
```

The `reconcile` method follows the "dispose-all + recreate" pattern used by the GitHub PR extension for simplicity. On each WebSocket event, all existing VS Code CommentThreads are disposed and recreated from the fresh server state. This avoids complex diffing logic for the MVP.

[ASSUMPTION: For the rapid prototype, dispose-and-recreate is acceptable. If performance becomes an issue with many threads (50+), we can switch to incremental updates later.]

## Line Number Translation

Session data uses 1-based line numbers. VS Code uses 0-based positions.

```typescript
function sessionLineToRange(line: number, lineEnd?: number): vscode.Range {
  const startLine = line - 1;           // 1-based -> 0-based
  const endLine = (lineEnd ?? line) - 1;
  return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
}

function rangeToSessionLine(range: vscode.Range): { line: number; lineEnd?: number } {
  const line = range.start.line + 1;     // 0-based -> 1-based
  const lineEnd = range.end.line + 1;
  return line === lineEnd ? { line } : { line, lineEnd };
}
```

## Comment Author Display

Messages from VS Code use author `"vscode-user"`. Messages from the browser review UI use whatever author the server assigns (typically `"claude"` for automated reviews or `"reviewer"` for manual ones). The extension displays author names as-is in the comment widget header.

[ASSUMPTION: No user identity system exists. Author names are informational labels, not authenticated identities.]

## Extension Packaging

For the rapid prototype:
- The extension is developed in `apps/vscode/` within the monorepo
- Built with esbuild to a single `dist/extension.js` bundle
- Installed locally via `code --install-extension ./apps/vscode/local-review-0.1.0.vsix`
- A `pnpm -C apps/vscode package` script runs `@vscode/vsce package`

The `package.json` contributes:
- `commentController`: ID `local-review`, label `Local Review`
- Commands: `local-review.refresh`, `local-review.connect`, `local-review.disconnect`
- Configuration: `local-review.serverUrl` (default `http://localhost:37003`)
- Status bar item showing connection state

## Key Design Decisions

### D1: Standalone extension vs. Claude Code extension integration

**Decision**: Standalone extension.
**Rationale**: The `anthropic.claude-code` VS Code extension is not extensible. There is no plugin API to add CommentController features to it. A standalone extension is the only viable approach.

### D2: Dispose-and-recreate vs. incremental thread updates

**Decision**: Dispose-and-recreate on each sync event for MVP.
**Rationale**: Incremental diffing of VS Code CommentThread objects is complex (no enumeration API, must track state manually). The GitHub PR extension uses the same dispose-and-recreate pattern. For a typical review session with 5-20 threads, the performance cost is negligible. Can optimize later if needed.

### D3: Extension in monorepo vs. separate repository

**Decision**: Monorepo (`apps/vscode/`).
**Rationale**: The extension shares TypeScript types with the server (`ReviewThread`, `ReviewMessage`, `ThreadAnchor`). Keeping it in the same repo allows direct imports (via tsconfig paths or shared package) and ensures type changes propagate to both server and extension. The tight coupling to the server API makes a separate repo impractical for rapid development.

### D4: Server port discovery

**Decision**: Configurable via `local-review.serverUrl` setting, default `http://localhost:37003`.
**Rationale**: The server port is configurable via `PORT` env var but defaults to 37003. For the MVP, a VS Code setting is sufficient. Future enhancement could auto-discover the port by reading the server's PID file or a well-known config path.

### D5: Which threads to display

**Decision**: Show all threads regardless of status, but collapse resolved threads. Skip `side: "old"` anchors.
**Rationale**: Users may want to see resolved threads for context. VS Code CommentThread supports a `collapsibleState` property -- resolved threads can default to collapsed while open threads expand automatically. Threads anchored to deleted/old-side lines cannot be mapped to working tree files and are skipped with a logged warning.

### D6: Error handling for thread operations

**Decision**: Optimistic local display with server confirmation. On POST/PATCH failure, show VS Code error notification and remove the optimistic local thread. No automatic retry for write operations (reads retry via WebSocket reconnect).
**Rationale**: For the MVP, simple error reporting is sufficient. The dispose-and-recreate sync pattern ensures stale optimistic state is cleaned up on the next successful WebSocket event.

### D7: Echo deduplication

**Decision**: After creating/updating a thread, the extension sets a short "mute window" (500ms) keyed by thread ID. WebSocket events for that thread ID within the window are ignored to prevent flickering from the server echo.
**Rationale**: The dispose-and-recreate pattern would otherwise flash the UI when the extension's own writes echo back via WebSocket.
