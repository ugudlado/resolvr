# VS Code Serverless Extension -- Design

## Approaches Evaluated

### A: Thin abstraction layer (selected)

Replace `serverClient` with a `sessionStore` module that performs the same operations via direct file I/O. All call sites swap one import for another. The interface stays similar (`getSession`, `saveSession`, `createThread`, `updateThread`, `setVerdict`) but the implementation reads/writes JSON files instead of making HTTP calls.

**Pros**: Minimal diff, easy to review, preserves existing control flow.
**Cons**: None significant.

### B: Inline file ops at each call site

Remove the abstraction entirely and put `fs.readFile`/`fs.writeFile` directly in `commentManager.ts`, `extension.ts`, etc.

**Pros**: No indirection.
**Cons**: Duplicated read-modify-write logic, harder to maintain atomic write guarantees.

### C: SQLite or other local DB

Replace JSON files with a local database for better concurrency.

**Pros**: Better concurrent access handling.
**Cons**: Massive over-engineering for a local tool, breaks compatibility with browser UI and `/resolve` command.

**Decision**: Approach A. The abstraction boundary is valuable and the migration is mechanical.

## Component Breakdown

### New: `sessionStore.ts` (replaces `serverClient.ts`)

Single module responsible for all session file I/O. Mirrors the `serverClient` API shape for minimal call-site changes.

```typescript
// Core state
let _workspaceName: string | null = null;
let _sessionsDir: string | null = null;

export function setWorkspaceName(name: string): void;
export function getSessionsDir(): string; // ~/.config/local-review/workspace/{name}/sessions/
export function getSessionFilePath(featureId: string): string; // {sessionsDir}/{featureId}-code.json

// Session operations (all file-based)
export const sessionStore = {
  getSession(featureId: string): Promise<SessionData | null>;
  saveSession(featureId: string, session: SessionData): Promise<void>;
  createThread(featureId: string, thread: SessionThread): Promise<void>;
  updateThread(featureId: string, threadId: string, patch: Partial<...>): Promise<void>;
  setVerdict(featureId: string, verdict: string): Promise<void>;
};
```

**Implementation details**:

- `getSession`: `fs.readFile` + `JSON.parse`, returns `null` if file not found
- `saveSession`: `JSON.stringify` + atomic write (temp + rename), stamps `workspaceName` and `metadata.updatedAt`
- `createThread`: read session, push thread to `threads[]`, save session
- `updateThread`: read session, find thread by ID, merge `status`/`severity`/`labels`; for `messages`, append (not replace -- matches server behavior); save session
- `setVerdict`: read session, set `verdict` field, save session
- Atomic write: write to temp file (`path + '.tmp.' + pid + '.' + Date.now()`) then rename to target path -- identical pattern to server's `fs-utils.ts`

### New: `sessionWatcher.ts` (replaces `wsClient.ts`)

Watches the session file for external changes and emits an event with the new session data.

```typescript
export class SessionWatcher implements vscode.Disposable {
  private _watcher: vscode.FileSystemWatcher | null = null;
  private _suppressUntil = 0; // timestamp-based self-write suppression

  readonly onDidSessionChange: vscode.Event<SessionData>;

  watch(sessionFilePath: string): void; // start watching a specific file
  unwatch(): void; // stop watching
  suppressNextChange(): void; // call before writing to suppress echo
  dispose(): void;
}
```

**Self-write suppression strategy**:
When the extension writes a session file, it calls `suppressNextChange()` which sets `_suppressUntil = Date.now() + 500`. When the file watcher fires, if `Date.now() < _suppressUntil`, the event is ignored. This is simpler and more reliable than the current `_pendingSkips` counter approach because:

- No need to count echoes (the server had 2 echoes: its own broadcast + browser auto-save)
- A single timestamp covers any number of rapid writes
- 500ms window matches the server's `suppressWatcherBroadcast` window

**Watcher lifecycle**:

- Created once during activation
- `watch()` called when featureId is detected (watches specific session file)
- `unwatch()` + `watch(newPath)` on branch change
- `unwatch()` when switching to non-feature branch

### New: `gitDiff.ts` (replaces `serverClient.getDiff()`)

Runs `git diff` locally and returns the same shape as the server API.

```typescript
export async function getLocalDiff(workspaceRoot: string): Promise<{
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  committedDiff: string;
  uncommittedDiff: string;
  allDiff: string;
}>;
```

**Implementation**:

1. Detect target branch: read session file for `targetBranch`, default to `main`
2. Detect source branch: `git rev-parse --abbrev-ref HEAD`
3. Committed diff: `execFile('git', ['diff', '{targetBranch}...HEAD'])`
4. Uncommitted diff: `execFile('git', ['diff', 'HEAD'])` (staged + unstaged vs HEAD)
5. All diff: `execFile('git', ['diff', targetBranch])` which includes both committed and uncommitted changes

Uses `child_process.execFile` (already used in `extension.ts` and `featureDetector.ts`). Note: `execFile` is used rather than `exec` to avoid shell injection -- arguments are passed as an array, not interpolated into a shell string.

### Modified: `commentManager.ts`

Changes:

- Import `sessionStore` instead of `serverClient`
- Replace all `serverClient.*` calls with `sessionStore.*` equivalents
- Remove `_pendingSkips` counter entirely -- no longer needed
- In `createComment`: after calling `sessionStore.createThread()`, immediately reconcile from the file (instead of disposing and waiting for WS echo)
- In `replyToComment`: after calling `sessionStore.updateThread()`, update the local VS Code thread directly (already done) -- no skip logic needed
- In status commands: after calling `sessionStore.updateThread()`, update thread state directly (already done)

The key simplification: every write is followed by a local UI update in the same call. No need to wait for a server echo or suppress incoming events.

### Modified: `extension.ts`

Major simplification of the `init()` and branch-change flows:

**Before** (server-dependent):

1. Resolve workspace name
2. Check server connection -- abort if unreachable
3. Fetch session via HTTP
4. Load threads
5. Connect WebSocket
6. Subscribe to WS events

**After** (file-based):

1. Resolve workspace name
2. Read session file from disk
3. Load threads
4. Start file watcher on session file
5. Subscribe to watcher events

**Removed**:

- `WsClient` instantiation and all WS event subscriptions
- `serverClient.checkConnection()` call and "disconnected" fallback
- `local-review.connect` / `local-review.disconnect` commands
- WS-based resolver progress events

**Simplified**:

- `startReview` command: writes session file directly (no HTTP)
- `requestChanges` command: writes verdict to file; [ASSUMPTION] resolver invocation deferred to manual `/resolve` in Claude session (see Open Questions)
- `openDiff` command: no server connection check needed
- Branch change handler: read file instead of HTTP call

### Modified: `diffPanelManager.ts`

Changes:

- Import `getLocalDiff` from `gitDiff.ts` instead of `serverClient`
- `populate()`: call `getLocalDiff(workspaceRoot)` instead of `serverClient.getDiff()`
- Everything else stays the same (tree provider, file decorations, diff tab opening)

### Modified: `statusBar.ts`

Remove states:

- `disconnected` -- no longer applicable

Rename states:

- `connected` -> `ready` (no connection to be "connected" to)

Remove methods:

- `setDisconnected()` -- unused
- `setConnected()` -> `setReady(threadCount: number)`

The `resolving` state remains if we support direct resolver invocation, otherwise it can also be removed.

### Deleted: `serverClient.ts`

Entirely replaced by `sessionStore.ts`. Type definitions (`SessionData`, `SessionThread`, `SessionMessage`) move to `sessionStore.ts` (they are co-located with the store since no other module needs them independently).

### Deleted: `wsClient.ts`

Entirely replaced by `sessionWatcher.ts`.

## Data Flow

### Comment Creation (new flow)

```
User types comment in VS Code gutter
  -> commentManager.createComment()
    -> sessionStore.createThread(featureId, thread)
      -> reads session file from disk
      -> appends thread to threads[]
      -> atomic write to disk
      -> calls sessionWatcher.suppressNextChange()
    -> commentManager.loadThreads(updatedSession.threads)
      -> threadMapper.reconcile() recreates VS Code threads
    -> threadsTree.updateThreads()
    -> statusBar.updateThreadCount()
```

### External Change Detection (new flow)

```
Browser UI saves session via server
  -> server writes to ~/.config/local-review/workspace/{name}/sessions/{featureId}-code.json
  -> VS Code FileSystemWatcher fires onChange
    -> sessionWatcher checks suppression timestamp -- not suppressed (external write)
    -> sessionWatcher reads file, parses JSON
    -> fires onDidSessionChange event with SessionData
  -> extension.ts handler:
    -> commentManager.loadThreads(session.threads)
    -> threadsTree.updateThreads(session.threads)
    -> statusBar.updateThreadCount(session.threads.length)
    -> diffPanelManager.updateThreadCounts(session.threads)
```

### Initialization (new flow)

```
Extension activates
  -> resolve workspace name (git rev-parse --git-common-dir)
  -> featureDetector.initialize() -> detects featureId from branch
  -> if no featureId: statusBar.setNoFeature(), return
  -> sessionStore.getSession(featureId)
    -> reads ~/.config/local-review/workspace/{name}/sessions/{featureId}-code.json
  -> if no session file: statusBar.setNoSession(), return
  -> commentManager.loadThreads(session.threads)
  -> statusBar.setReady(session.threads.length)
  -> threadsTree.updateThreads(session.threads)
  -> sessionWatcher.watch(sessionFilePath)
  -> getLocalDiff(workspaceRoot) -> execFile('git', ['diff', ...])
  -> diffPanelManager.populate() with diff data
```

## Error Handling

### File not found

`sessionStore.getSession()` returns `null` -- same as current server 404 handling. Extension shows "no session" state.

### Corrupt JSON

Wrap `JSON.parse` in try/catch. Log error to output channel, treat as "no session". Do not overwrite -- the user may want to recover the file.

### Concurrent writes

Last-write-wins with atomic rename. Both the extension and server use temp-file-then-rename, so partial writes are impossible. The worst case is one write being overwritten by another, which is acceptable for a local tool.

### File watcher missed events

VS Code's FileSystemWatcher can occasionally miss events (especially on macOS with rapid changes). Mitigation: the "Refresh" command re-reads from disk. No polling -- the manual refresh is sufficient for a local tool.

### Git diff failures

If `execFile('git', ['diff', ...])` fails (e.g., target branch doesn't exist), show an error message and leave the Changed Files sidebar empty. Log the git error to output channel.

## Migration Checklist

Files to create:

- `apps/vscode/src/sessionStore.ts` -- file-based session operations
- `apps/vscode/src/sessionWatcher.ts` -- file system watcher for session changes
- `apps/vscode/src/gitDiff.ts` -- local git diff execution

Files to modify:

- `apps/vscode/src/extension.ts` -- rewire init, remove WS, add watcher
- `apps/vscode/src/commentManager.ts` -- swap serverClient for sessionStore, remove skip logic
- `apps/vscode/src/diffPanelManager.ts` -- swap serverClient.getDiff for getLocalDiff
- `apps/vscode/src/statusBar.ts` -- simplify states
- `apps/vscode/src/threadMapper.ts` -- move type imports from serverClient to sessionStore
- `apps/vscode/package.json` -- remove `ws` dependency

Files to delete:

- `apps/vscode/src/serverClient.ts`
- `apps/vscode/src/wsClient.ts`

## Open Questions

### Q1: Resolver invocation strategy

The "Request Changes" command currently triggers the resolver via HTTP. Three options:

1. **Shell out to resolve script**: Extension runs the resolve script in a terminal
2. **Write verdict only**: Extension sets verdict in session file, user runs `/resolve` manually
3. **Keep server call as optional**: Try HTTP first, fall back to option 2

[ASSUMPTION] Option 2 is simplest and aligns with the serverless goal. The resolver is a Claude Code command, so it naturally runs in the Claude session, not in VS Code. The "Request Changes" button becomes "Request Changes" which writes the verdict and shows a notification: "Verdict saved. Run `/resolve` in your Claude session to process threads."

### Q2: Target branch detection for git diff

The server reads `targetBranch` from the session file. For git diff, the extension can:

1. Read the session file's `targetBranch` field (if session exists)
2. Default to `main` if no session exists yet

[ASSUMPTION] Option 1 with fallback to `main`. This matches current behavior.
