# VS Code Serverless Extension

## Motivation

The VS Code extension currently depends on the local-review HTTP server for all session operations (read, write, create thread, update thread, set verdict) and on a WebSocket connection for real-time sync. This creates unnecessary coupling: the extension cannot function unless the server process is running, even though the underlying data is just JSON files on disk.

The `/resolve` command already reads session files directly from disk, validating the approach. This change eliminates the server dependency entirely for the VS Code extension, making it a standalone tool that reads and writes session JSON files directly. The server remains only for the browser UI.

## Requirements

### Functional Requirements

**FR-1: Direct file I/O for sessions**
Replace all `serverClient` HTTP calls with direct filesystem operations:

- Read session: `fs.readFile` on `~/.config/local-review/workspace/{repoName}/sessions/{featureId}-code.json`
- Write session: atomic write (temp file + rename) to the same path
- Create thread: read session, append thread to `threads[]`, atomic write
- Update thread: read session, find thread by ID, merge patch, atomic write
- Set verdict: read session, set `verdict` field, atomic write
- Auto-create session on first comment if file does not exist

**FR-2: File-system watching for external changes**
Replace the WebSocket client with `vscode.workspace.createFileSystemWatcher` on the session file:

- Watch `~/.config/local-review/workspace/{repoName}/sessions/{featureId}-code.json`
- On external change: re-read the file, reconcile threads in the Comment API
- Must suppress self-triggered changes (when the extension itself writes the file)

**FR-3: Direct git diff**
Replace the `serverClient.getDiff()` HTTP call with local `git diff` execution:

- Run `git diff main...HEAD` (or `targetBranch...sourceBranch`) for committed changes
- Run `git diff` for uncommitted changes
- Parse the unified diff output locally (reuse existing `diffParser.ts`)

**FR-4: Session directory discovery**
The extension must resolve the session directory path independently:

- Resolve workspace name from `git rev-parse --git-common-dir` (already done for `setWorkspaceName`)
- Construct path: `~/.config/local-review/workspace/{repoName}/sessions/`
- Create the directory on first write if it does not exist (`mkdirSync({ recursive: true })`)

**FR-5: Resolver invocation without server**
The "Request Changes" command currently calls `serverClient.triggerResolve()`, which hits the server's `/api/resolver/resolve` endpoint. Without the server:

- [ASSUMPTION] The extension will shell out to the `/resolve` Claude Code command or invoke the resolver script directly. The resolver reads/writes the session file on disk, so it does not need the server.
- Alternatively, the extension can set the verdict on disk and let the user run `/resolve` manually in their Claude session.

**FR-6: Status bar simplification**
Remove "connected/disconnected" states. New states:

- `no-feature` -- no feature branch detected
- `no-session` -- feature branch but no session file exists (click to create)
- `ready` -- session loaded, showing thread count
- `resolving` -- resolver is running (if we support direct invocation)

### Non-Functional Requirements

**NFR-1: Zero server dependency**
The extension must activate and function fully without any server process running. No HTTP calls, no WebSocket connections, no connection checks.

**NFR-2: Atomic writes**
All session file writes must use the temp-file-then-rename pattern to prevent corruption from concurrent access (browser UI via server may write simultaneously).

**NFR-3: Self-write suppression**
The file watcher must not trigger a reconcile when the extension itself wrote the file. Use a timestamp or flag-based suppression mechanism.

**NFR-4: Backward compatibility**
Session file format remains unchanged. Files written by the extension must be readable by the server/browser UI and vice versa. The `workspaceName` field must be stamped on all writes (matching server behavior).

**NFR-5: Minimal bundle impact**
Removing `ws` (WebSocket) dependency from the extension bundle reduces size. No new npm dependencies required -- all capabilities come from Node.js built-ins and VS Code API.

## User Stories

**US-1**: As a developer, I can open VS Code on a feature branch and see review comments immediately, without starting the local-review server.

**US-2**: As a developer, I can add review comments in VS Code and they appear in the browser UI (when the server is running) because both read from the same session file.

**US-3**: As a developer, when someone adds a comment in the browser UI, I see it appear in VS Code within seconds because the file watcher detects the session file change.

**US-4**: As a developer, I can view the Changed Files sidebar and open diffs without the server, because diffs are generated from `git diff` locally.

**US-5**: As a developer, the extension works in git worktrees with correct workspace name resolution and session path construction.

## Acceptance Criteria

- [ ] Extension activates and loads session from disk without server running
- [ ] Creating a comment writes to the session file on disk (verified by `cat` on the file)
- [ ] Replying to a thread appends the message to the session file
- [ ] Changing thread status (resolve, reopen, wontfix, outdated) updates the session file
- [ ] File watcher detects external changes and reconciles threads in the Comment API
- [ ] Self-writes do not trigger a redundant reconcile
- [ ] Changed Files sidebar populates from `git diff` output (no server call)
- [ ] Diff tabs open correctly for added, modified, deleted, and renamed files
- [ ] Session auto-created on first comment when no session file exists
- [ ] `workspaceName` field is stamped on every session write
- [ ] Status bar shows appropriate state (no "disconnected" state)
- [ ] Extension works in git worktrees (correct workspace name, session path)
- [ ] `ws` npm dependency removed from extension `package.json`
- [ ] `serverClient.ts` and `wsClient.ts` deleted (or emptied)
- [ ] No remaining imports of `serverClient` or `wsClient` in the codebase

## Alternatives Considered

### Keep server as optional dependency

The extension could try the server first and fall back to file I/O. This was rejected because it adds complexity (dual code paths, error handling for server being unavailable) for no benefit -- the file-based approach is strictly simpler and always available.

### Use VS Code workspace storage

VS Code provides `context.workspaceState` and `context.globalState` for extension data. This was rejected because the session files must be shared with the browser UI and the `/resolve` command, which both expect files at `~/.config/local-review/workspace/{repoName}/sessions/`.

### Event-based IPC instead of file watching

The extension could communicate with the server via IPC (named pipes, Unix sockets) instead of WebSocket. This was rejected because it still requires the server to be running, which is the dependency we want to eliminate.
