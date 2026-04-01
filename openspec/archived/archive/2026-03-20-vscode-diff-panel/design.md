# Design: VS Code Diff Panel with Inline Review

## Architecture Overview

```
                         "Local Review: Open Diff"
                                  |
                                  v
                        +-------------------+
                        |  DiffPanelManager |--- opens diff tabs ----> [ VS Code Diff Editor ]
                        +-------------------+                            left:  local-review-base:path
                                |                                        right: file:///worktree/path
                                |
                    +-----------+-----------+
                    |                       |
            +---------------+     +--------------------+
            | BaseContent   |     | ChangedFilesTree   |
            | Provider      |     | View               |
            | (virtual docs)|     | (sidebar navigator)|
            +---------------+     +--------------------+
                    |                       |
                    | git show main:<path>  | parsed from diff headers
                    v                       v
            +------------------+    +------------------+
            | serverClient     |    | diffParser       |
            | .getDiff()       |    | (shared utility) |
            +------------------+    +------------------+
                    |
                    v
            [ local-review server GET /api/diff ]
```

The diff panel is layered on top of the existing extension. It adds three new modules (`DiffPanelManager`, `BaseContentProvider`, `ChangedFilesTreeProvider`) and extends two existing ones (`CommentManager`, `serverClient`). All real-time sync, thread lifecycle, and status bar behavior remain unchanged.

## Approach Evaluation

### Option A: Native `vscode.diff` + TextDocumentContentProvider (Selected)

Uses VS Code's built-in diff editor. Register a `TextDocumentContentProvider` for a custom scheme (`local-review-base:`) that serves file content at the merge-base via `git show main:<path>`. Open diffs with `vscode.commands.executeCommand("vscode.diff", oldUri, newUri, title)`.

**Pros**:

- Native syntax highlighting, themes, keyboard shortcuts, minimap
- CommentController threads attach to both real URIs and virtual URIs natively
- Lowest implementation effort -- VS Code handles all diff rendering
- Consistent with VS Code's own SCM diff UX

**Cons**:

- Old-side document is read-only (expected for review)
- Limited control over diff layout (relies on user's `diffEditor` settings)
- Virtual URIs need careful lifecycle management to avoid stale content

### Option B: WebviewPanel with custom HTML diff

Full HTML rendering in a VS Code webview tab. Could reuse the browser UI's `DiffTable.tsx` component.

**Pros**:

- Full control over UX, could match browser UI exactly
- Could embed thread widgets inline (like the browser's `ThreadWidget`)

**Cons**:

- Requires a separate webpack/esbuild bundle for the webview
- Loses all native VS Code features (syntax highlighting, minimap, settings)
- Async message-passing for all interactions (postMessage bridge)
- CommentController does not work inside webviews -- must reimplement comment UI
- Significant additional code surface and maintenance burden
- Users would see an unfamiliar rendering that does not match their VS Code theme

**Rejected**: The implementation cost and UX degradation far outweigh the layout flexibility.

### Option C: `vscode.changes` command

A thin wrapper around `vscode.diff` that can open multiple diffs as a named group.

**Pros**:

- Groups related diffs under a label in the editor tabs

**Cons**:

- Undocumented internal API; may break across VS Code versions
- No additional functionality over Option A's `vscode.diff` command
- Cannot customize the tab group behavior

**Rejected**: Undocumented API with no real benefit over Option A.

## Component Design

### New Module: `baseContentProvider.ts`

Provides old-side file content for diff editors via a virtual document scheme.

```typescript
// URI scheme: local-review-base:/<relative-path>?ref=<branch>
// Example:   local-review-base:/src/utils/parser.ts?ref=main

class BaseContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private _cache = new Map<string, string>(); // path -> content
  private _ref: string; // resolved via `git merge-base HEAD main` (SHA, not branch name)
  private _workspaceRoot: string;

  provideTextDocumentContent(uri: vscode.Uri): Promise<string>;
  invalidate(path?: string): void; // clear cache, fire onDidChange
}
```

**Content resolution**:

1. Parse relative path from URI: `uri.path` (leading slash stripped)
2. Check cache; if hit, return cached content
3. Run `git show <ref>:<path>` in the workspace root
4. Cache result and return
5. For deleted files (file exists at ref but not in working tree): content is served normally
6. For new files (file does not exist at ref): return empty string (diff shows all lines as added)

**Cache invalidation**: The `invalidate()` method clears the cache and fires `onDidChange` for all cached URIs (or a specific path). Called by `DiffPanelManager.refresh()`.

**Error handling**: If `git show` fails (path not found at ref), return empty string. This handles renamed files gracefully -- the old path shows empty, the new path shows the full file.

**Empty content provider**: A trivial second provider (`local-review-empty:` scheme) is registered alongside `BaseContentProvider`. It always returns an empty string. Used for the new-side URI of deleted files, avoiding reliance on error fallbacks.

**Registration ordering**: Both `BaseContentProvider` and the empty content provider MUST be registered in `activate()` before `CommentManager` is initialized. This is critical because `_buildNewThread` calls `vscode.workspace.openTextDocument(uri)` on virtual URIs to compute line hashes — this requires the provider to already be registered. The activation sequence is: (1) register content providers, (2) create CommentManager, (3) wire up diff panel.

### New Module: `diffPanelManager.ts`

Orchestrates the diff panel: fetches diff data, parses it, opens diff tabs, manages the file navigator.

```typescript
class DiffPanelManager implements vscode.Disposable {
  private _files: DiffFile[] = [];
  private _baseProvider: BaseContentProvider;
  private _treeProvider: ChangedFilesTreeProvider;

  constructor(
    workspaceRoot: string,
    baseProvider: BaseContentProvider,
    outputChannel: vscode.OutputChannel,
  );

  // Fetch diff from server, parse, populate file navigator
  async open(featureId: string): Promise<void>;

  // Open a specific file's diff tab
  async openFile(file: DiffFile): Promise<void>;

  // Refresh diff data (re-fetch, invalidate base content cache)
  async refresh(featureId: string): Promise<void>;

  dispose(): void;
}
```

**`open()` flow**:

1. Call `serverClient.getDiff(workspaceRoot)` to get unified diff strings
2. Parse `allDiff` (committed + uncommitted, deduplicated) using a lightweight diff header parser (extract file paths and statuses -- does not need full hunk parsing for the navigator)
3. Populate `ChangedFilesTreeProvider` with the file list
4. Reveal the tree view in the sidebar
5. Auto-open the first file's diff tab

**Error handling**: If `serverClient.getDiff()` throws (server unreachable, 404, etc.), show `vscode.window.showErrorMessage` with the failure reason. Same for `refresh()`. Do not leave the TreeView in a stale state — clear it on error.

**`openFile()` flow**:

1. Construct old-side URI: `vscode.Uri.parse(\`local-review-base:/${file.path}?ref=main\`)`
2. Construct new-side URI: `vscode.Uri.file(\`${workspaceRoot}/${file.path}\`)`
3. Handle special cases:
   - **Deleted file**: old URI has content, new URI uses a dedicated empty-content scheme (`local-review-empty:/${file.path}`) registered alongside `BaseContentProvider` that always returns an empty string. This avoids relying on error fallbacks in the base content provider.
   - **New file**: old URI returns empty string, new URI is the working-tree file.
   - **Renamed file**: old URI uses `file.oldPath`, new URI uses `file.newPath`.
4. Execute: `vscode.commands.executeCommand("vscode.diff", oldUri, newUri, \`${file.path} (Review Diff)\`)`

### New Module: `changedFilesTree.ts`

TreeView data provider for the sidebar file navigator.

```typescript
class ChangedFilesTreeProvider
  implements vscode.TreeDataProvider<DiffFileItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _files: DiffFileItem[] = [];
  private _threadCounts: Map<string, number>; // path -> open thread count

  setFiles(files: DiffFile[]): void;
  updateThreadCounts(threads: SessionThread[]): void;

  getTreeItem(element: DiffFileItem): vscode.TreeItem;
  getChildren(): DiffFileItem[];
}

interface DiffFileItem {
  path: string;
  oldPath: string;
  status: "A" | "M" | "D" | "R"; // Added, Modified, Deleted, Renamed
  openThreads: number;
}
```

**TreeItem rendering**:

- Icon: `$(diff-added)`, `$(diff-modified)`, `$(diff-removed)`, `$(diff-renamed)` based on status
- Description: shows open thread count if > 0 (e.g., "3 comments")
- Command: `local-review.openDiffFile` which calls `diffPanelManager.openFile()`

**TreeView registration**: Contributed in `package.json` under `views.explorer` or a custom `localReview` view container.

### Extended: `commentManager.ts`

The CommentManager needs two changes to support the diff panel:

**Change 1: commentingRangeProvider covers virtual URIs**

The current `commentingRangeProvider` only returns ranges for real file URIs. It must also return ranges for `local-review-base:` URIs so the "+" gutter icon appears on old-side lines.

```typescript
// Before:
commentingRangeProvider = {
  provideCommentingRanges(document: vscode.TextDocument) {
    return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
  },
};

// After:
commentingRangeProvider = {
  provideCommentingRanges(document: vscode.TextDocument) {
    // Allow commenting on real files AND virtual base-content files
    if (
      document.uri.scheme === "file" ||
      document.uri.scheme === "local-review-base"
    ) {
      return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
    }
    return [];
  },
};
```

**Change 2: \_createVSCodeThread supports old-side anchors**

Remove the `side === "old"` skip logic. Instead, route old-side threads to virtual URIs:

```typescript
// Before (line 302-308):
if (threadSide === "old") {
  this._outputChannel.appendLine(`Skipping old-side thread ...`);
  return null;
}

// After:
let fileUri: vscode.Uri;
if (threadSide === "old") {
  fileUri = vscode.Uri.parse(`local-review-base:/${threadPath}?ref=main`);
} else {
  fileUri = vscode.Uri.file(`${this._workspaceRoot}/${threadPath}`);
}
```

This means old-side threads render in the diff editor's left pane (where the virtual document is open) and new-side threads render in the right pane (the real file). When no diff is open, old-side threads render nowhere (the virtual document is not visible), which is the same as the current behavior.

**Change 3: \_buildNewThread detects old-side context**

When a user creates a comment on a `local-review-base:` URI, the thread anchor must record `side: "old"` and extract the relative path from the virtual URI rather than the workspace-relative path.

```typescript
private async _buildNewThread(vsThread: vscode.CommentThread, text: string): Promise<SessionThread> {
  const uri = vsThread.uri;
  let relativePath: string;
  let side: "old" | "new";

  if (uri.scheme === "local-review-base") {
    relativePath = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
    side = "old";
  } else {
    relativePath = vscode.workspace.asRelativePath(uri);
    side = "new";
  }
  // ... rest unchanged, but uses `side` variable in anchor
}
```

### Extended: `serverClient.ts`

Add a single new method:

```typescript
async getDiff(worktreePath: string): Promise<{
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  committedDiff: string;
  uncommittedDiff: string;
  allDiff: string;
}> {
  const url = `${getBaseUrl()}/api/diff?worktree=${encodeURIComponent(worktreePath)}`;
  const res = await httpRequest(url, {});
  if (res.status >= 400) {
    throw new Error(`Diff API error: ${res.status} ${res.body}`);
  }
  return JSON.parse(res.body);
}
```

## Data Flow

### Opening the Diff Panel

```
1. User runs "Local Review: Open Diff"
2. diffPanelManager.open(featureId)
3.   serverClient.getDiff(workspaceRoot)
       -> GET /api/diff?worktree=/path/to/worktree
       <- { allDiff, committedDiff, uncommittedDiff, sourceBranch, targetBranch, ... }
4.   Parse allDiff headers to extract file list (includes both committed and uncommitted changes)
       -> DiffFile[] with path, oldPath, status
5.   changedFilesTree.setFiles(files)
       -> TreeView updates in sidebar
6.   diffPanelManager.openFile(files[0])
       -> baseContentProvider resolves old-side content
       -> vscode.diff opens tab
7.   commentManager renders threads on both sides
```

### Adding a Comment on the Old Side

```
1. User clicks "+" on line 42 of left (old) pane
2. VS Code creates temporary CommentThread on local-review-base:/src/foo.ts
3. User types comment, submits
4. commentManager.createComment handler fires
5.   Detects uri.scheme === "local-review-base" -> side = "old"
6.   Extracts relativePath from virtual URI
7.   Builds SessionThread with anchor { side: "old", line: 42, path: "src/foo.ts" }
8.   serverClient.createThread(featureId, thread)
9.   Server saves, broadcasts WS event
10.  Thread now visible in:
     - Diff panel left pane (old side)
     - Browser UI diff view (old side)
     - NOT in working-tree inline comments (old-side filter still applies there)
```

### Refreshing the Diff

```
1. User makes new commits or runs "Local Review: Refresh"
2. diffPanelManager.refresh(featureId)
3.   serverClient.getDiff(workspaceRoot) -> fresh diff data
4.   baseContentProvider.invalidate() -> clears cache, fires onDidChange
5.   VS Code re-reads all open virtual documents
6.   changedFilesTree.setFiles(newFiles) -> navigator updates
7.   Open diff tabs update automatically (VS Code re-diffs)
```

## Diff Header Parser

The extension needs to extract file paths and statuses from the unified diff output but does NOT need full hunk/line parsing (that is only needed for the browser UI's `DiffTable`). A lightweight parser:

```typescript
interface DiffFileEntry {
  path: string; // display path (new path for renames)
  oldPath: string; // path in base ref
  newPath: string; // path in HEAD
  status: "A" | "M" | "D" | "R";
}

function parseDiffFileList(unifiedDiff: string): DiffFileEntry[] {
  // Split on "diff --git" boundaries
  // For each block:
  //   - Parse "diff --git a/<old> b/<new>" for paths
  //   - Check for "new file mode" -> status "A"
  //   - Check for "deleted file mode" -> status "D"
  //   - Check for "rename from/to" -> status "R"
  //   - Otherwise -> status "M"
}
```

This is deliberately separate from `apps/ui/src/utils/diffParser.ts`. The browser parser does full hunk-level parsing for rendering; the extension parser only needs file-level metadata. Sharing the browser parser would pull in unnecessary complexity and create a cross-workspace dependency. The extension parser is approximately 30-40 lines.

[ASSUMPTION: The lightweight parser is sufficient. If future features need hunk-level data in the extension (e.g., jump-to-hunk navigation), the browser parser could be extracted to a shared package at that point.]

## File Structure

```
apps/vscode/src/
  extension.ts              -- (modified) register new commands, wire DiffPanelManager
  commentManager.ts         -- (modified) support old-side URIs + virtual scheme
  serverClient.ts           -- (modified) add getDiff() method
  baseContentProvider.ts    -- (new) TextDocumentContentProvider for git show content
  diffPanelManager.ts       -- (new) orchestrates diff panel lifecycle
  changedFilesTree.ts       -- (new) TreeDataProvider for file navigator
  diffParser.ts             -- (new) lightweight diff header parser
  featureDetector.ts        -- (unchanged)
  threadMapper.ts           -- (unchanged)
  wsClient.ts               -- (unchanged)
  statusBar.ts              -- (unchanged)
```

## package.json Contributions

```jsonc
{
  "contributes": {
    "commands": [
      // ... existing commands ...
      {
        "command": "local-review.openDiff",
        "title": "Local Review: Open Diff",
        "icon": "$(diff)",
      },
      {
        "command": "local-review.openDiffFile",
        "title": "Local Review: Open Diff File",
      },
      {
        "command": "local-review.refreshDiff",
        "title": "Local Review: Refresh Diff",
        "icon": "$(refresh)",
      },
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "local-review",
          "title": "Local Review",
          "icon": "$(comment-discussion)",
        },
      ],
    },
    "views": {
      "local-review": [
        {
          "id": "localReview.changedFiles",
          "name": "Changed Files",
          "when": "local-review.hasDiffPanel",
        },
      ],
    },
    "menus": {
      "view/title": [
        {
          "command": "local-review.refreshDiff",
          "when": "view == localReview.changedFiles",
          "group": "navigation",
        },
      ],
    },
  },
}
```

The `local-review.hasDiffPanel` context key is set to `true` when the diff panel opens and `false` when the user explicitly runs "Local Review: Close Diff" or switches to a non-feature branch. VS Code has no API to detect when the last diff tab is closed, so the context key lifecycle is explicitly command-driven rather than tab-driven.

The `local-review.openDiffFile` command takes a `DiffFile` argument and should not appear in the Command Palette. Mark it with `"enablement": "false"` in `package.json` menus so it is only invocable from the TreeView click handler.

## Key Design Decisions

### D1: Native diff editor vs. webview

**Decision**: Native `vscode.diff` command with `TextDocumentContentProvider`.

**Rationale**: A webview would require reimplementing syntax highlighting, diff rendering, comment widgets, theme support, and keyboard shortcuts. VS Code's native diff editor provides all of this for free. The CommentController API attaches to both real and virtual document URIs, so comments work on both sides without custom UI. The only trade-off is less control over layout, but the native diff is what VS Code users expect.

### D2: Sidebar TreeView vs. QuickPick for file navigation

**Decision**: Sidebar TreeView in a dedicated view container.

**Rationale**: A QuickPick is transient -- it disappears after selection. For a review workflow where the user navigates through files sequentially, a persistent sidebar panel is more appropriate. It also allows showing thread count badges and file status icons. The view container groups the file list under a "Local Review" icon in the activity bar, keeping it out of the Explorer clutter.

### D3: Separate lightweight diff parser vs. sharing browser's diffParser

**Decision**: Separate lightweight parser in the extension.

**Rationale**: The browser's `parseUnifiedDiff()` does full hunk-level parsing (line-by-line with oldLineNumber/newLineNumber mapping) which is needed for rendering the HTML diff table. The extension only needs file paths and statuses from diff headers -- approximately 30 lines of parsing logic. Sharing the browser parser would require either (a) extracting it to a shared package (new workspace, build config) or (b) copying and maintaining a heavy parser the extension does not need. The lightweight parser is simpler to build and maintain.

### D4: All changes (committed + uncommitted) vs. committed only

**Decision**: Show all changes -- both committed and uncommitted -- relative to `main`.

**Rationale**: The diff panel is for self-review during active development. Developers often want to review their work before committing, not just after. The server's `allDiff` field already provides a deduplicated unified diff covering both committed and uncommitted changes. The right side of the diff uses `file://` URIs pointing to real working-tree files, so VS Code naturally shows the current file state including unsaved edits. The left side always shows `git show main:<path>` (the base content), which is the correct comparison point regardless of commit state. This simplifies the mental model: "Open Diff shows everything that changed on this branch."

### D5: Cache strategy for base content

**Decision**: In-memory cache per file path, invalidated on explicit refresh.

**Rationale**: The base content (`git show main:<path>`) does not change unless the user rebases or the target branch advances. Caching avoids repeated `git show` calls when switching between diff tabs. Explicit invalidation (refresh command) is simpler than file-watching the merge-base, which would require tracking `main` ref changes -- an edge case during active review.

### D6: Old-side thread rendering in non-diff context

**Decision**: Old-side threads render only when their virtual document is open (i.e., in the diff panel). They remain invisible in the inline working-tree view.

**Rationale**: There is no meaningful location to show an old-side thread on the current working-tree file -- the line it references may have been deleted or moved. The virtual URI approach naturally scopes old-side threads to the diff context. This is consistent with how GitHub handles old-side comments (visible in the diff view, not in the source file).

### D7: View container placement

**Decision**: Dedicated activity bar icon ("Local Review") rather than nesting under Explorer.

**Rationale**: A dedicated view container gives the feature its own activity bar icon, making it discoverable. It also avoids cluttering the Explorer with review-specific panels. The view container only shows content when the diff panel is active (gated by the `local-review.hasDiffPanel` context key), so it does not add visual noise when not in use. Future enhancements (thread list, review summary) can be added as additional views in the same container.

### D8: Handling renamed files

**Decision**: For renamed files, the old-side URI uses the old path and the new-side URI uses the new path.

**Rationale**: `git show main:<oldPath>` returns the content before the rename, and the working tree has the file at the new path. VS Code's diff editor handles mismatched paths gracefully -- it shows the content diff regardless of path differences. The file navigator shows the new path with a "renamed from" description.
