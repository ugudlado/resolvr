# Specification: VS Code Diff Panel with Inline Review

## Motivation

The existing VS Code extension (built in 2026-03-19-vscode-annotations) places review comments on working-tree files. This works for simple cases, but has fundamental limitations for self-review:

1. **No diff context**: Comments float on the current file state. The reviewer cannot see what changed -- they must mentally reconstruct the diff or open VS Code's SCM diff separately and lose the comment annotations.
2. **Old-side threads are invisible**: The existing extension explicitly skips `side: "old"` threads (commentManager.ts line 303). Comments on deleted lines or pre-change code only appear in the browser UI.
3. **No structured review flow**: There is no way to walk through changed files one by one, like GitHub's "Files changed" tab. The user must know which files changed and navigate manually.

A dedicated diff panel that shows all changes (committed + uncommitted) relative to `main` with inline comment support would close all three gaps. The developer sees exactly what changed, can comment on both old and new sides, and can navigate files systematically -- all without leaving VS Code.

## Requirements

### R1: Open diff panel for feature branch

A command "Local Review: Open Diff" opens a multi-file diff view showing all changes (committed and uncommitted) between `main` and the current working tree. The diff data comes from the server's existing `GET /api/diff` endpoint, which returns both `committedDiff` and `uncommittedDiff` (combined as `allDiff`). If no feature branch is detected or no server connection exists, the command shows an appropriate error message.

### R2: Native VS Code diff editor per file

Each changed file opens as a VS Code diff editor tab (side-by-side or inline, respecting the user's `diffEditor.renderSideBySide` setting). The left side shows the file content at the merge-base (`main`), the right side shows the current working-tree content (including uncommitted changes). The extension uses a `TextDocumentContentProvider` with a custom URI scheme (e.g., `local-review-base:`) to serve the old-side file content via `git show main:<path>`. The right side uses `file://` URIs pointing to the actual working-tree files, so any unsaved or uncommitted changes are visible in real time.

### R3: File navigator for changed files

A TreeView in the sidebar (or a QuickPick menu) lists all files changed in the diff, grouped by status (added, modified, deleted). Clicking a file opens its diff tab. The navigator shows a count badge (e.g., "12 files changed") and highlights files with open review threads.

### R4: Comment on both old and new sides of the diff

The CommentController's `commentingRangeProvider` is extended to cover both the virtual (old-side) document and the real (new-side) document within diff editors. When a user adds a comment on the old side, the thread anchor records `side: "old"` with the old-side line number. When adding on the new side, it records `side: "new"`. Both are persisted to the server session.

### R5: Display existing threads on both sides of the diff

When the diff panel loads, existing session threads are rendered at their correct positions -- `side: "new"` threads on the right pane, `side: "old"` threads on the left pane (using the virtual document URI). Threads created in the browser UI or by the AI resolver appear in the diff panel and vice versa.

### R6: AI-assisted review from the diff panel

The existing "Request Changes" command works from the diff panel context. The user reviews the diff, adds comments on specific lines, then triggers the AI resolver. Resolver progress appears in the status bar. Agent responses appear as new comments on the appropriate diff lines. The full review loop (comment, resolve, reply, re-resolve) works entirely within the diff panel.

### R7: Refresh diff on file changes

When the underlying git state changes (new commits, amended commits, file saves), the diff panel can be refreshed via a toolbar button or the existing "Local Review: Refresh" command. The `TextDocumentContentProvider` fires `onDidChange` to invalidate cached old-side content. Thread positions are re-validated against the updated diff.

### R8: Coexistence with inline working-tree comments

The diff panel and the existing inline working-tree comments operate independently. Both render from the same session data. A thread created in the diff panel appears on the working-tree file (if `side: "new"`) and vice versa. Old-side threads only appear in the diff panel. The user can use either or both modes.

## Non-Functional Requirements

### NF1: Native look and feel

The diff view must use VS Code's built-in diff editor, not a webview. This ensures consistent syntax highlighting, keyboard shortcuts, minimap, and theme support. Users should not be able to distinguish it from VS Code's built-in SCM diff except for the added comment support.

### NF2: Performance on large diffs

Diff data is fetched once per "Open Diff" invocation and cached. Individual file content (for `git show`) is fetched lazily when the user opens a specific file's diff tab. The file navigator loads from the parsed diff header without reading file contents.

### NF3: No new server dependencies

The diff panel uses existing server endpoints (`GET /api/diff`, session CRUD, WebSocket). The only new server method is `getDiff()` in the extension's `serverClient.ts`. No server-side changes are required.

### NF4: Minimal new code surface

The implementation should reuse existing extension infrastructure: `CommentManager` for thread rendering, `ThreadMapper` for bidirectional mapping, `WsClient` for real-time sync, `FeatureDetector` for branch detection. New code is limited to the diff-specific modules (content provider, file navigator, diff command).

## User Stories

### US1: Structured self-review

A developer finishes a feature and wants to self-review before merging. They run "Local Review: Open Diff" from the command palette. A sidebar panel lists 8 changed files. They click the first file and see a side-by-side diff. They notice a missing null check on line 42 of the old code that should have been preserved. They click the "+" on the left (old) side and type: "This null check was removed but the caller still depends on it." The comment is saved with `side: "old"`, `line: 42`. They continue through all 8 files, adding 3 more comments, then click "Request Changes" to get AI suggestions.

### US2: AI review of a diff

A developer triggers "Request Changes" after opening the diff panel. The AI resolver processes 4 open threads and adds agent responses. The developer reads each response in the diff context -- seeing both what the AI suggests and the actual code change -- and either resolves or replies to continue the conversation.

### US3: Reviewing deleted code

A developer deletes an entire utility file during refactoring. In the diff panel, the file shows as "Deleted" with all lines marked red. A colleague's browser-UI comment on line 15 (`side: "old"`) now renders correctly in the diff panel's left pane, whereas it was invisible in the inline working-tree view.

## Out of Scope

- **Multi-commit navigation**: No per-commit diff stepping. The diff shows the cumulative branch diff against main.
- **Inline diff rendering mode**: The diff panel uses VS Code's default diff layout. Custom rendering (unified diff in a single pane) is not in scope.
- **Drag-and-drop file reordering**: The file navigator uses alphabetical ordering. Custom ordering is not in scope.
- **Diff for non-feature branches**: The diff panel only activates on `feature/*` branches. Arbitrary branch comparisons are not supported.

## Success Criteria

1. A user can run "Local Review: Open Diff" and see a file navigator with all changed files within 3 seconds.
2. Clicking a file opens a native VS Code diff editor with the correct old (main) and new (working tree) content, including uncommitted changes.
3. A user can add comments on both old-side and new-side lines, and both are persisted to the server session with correct `side` and `line` values.
4. Old-side threads from the browser UI or AI resolver render correctly in the diff panel's left pane.
5. The full AI review loop (comment, request changes, read AI response, reply, re-resolve) works entirely within the diff panel.
6. The diff panel coexists with inline working-tree comments without conflicts or duplicate threads.

## Review Summary

Cross-model review identified and fixed 3 critical issues before implementation:

1. **[claude-reviewer] Wrong endpoint URL** — Design used `/api/context/diff` but the actual server route is `/api/diff`. Fixed in spec and design.
2. **[claude-reviewer] Deleted-file URI handling** — Design relied on error fallbacks in `BaseContentProvider` for deleted-file new-side content. Fixed by introducing a dedicated `local-review-empty:` scheme that explicitly returns empty strings.
3. **[claude-reviewer] Provider registration ordering** — `_buildNewThread` calls `openTextDocument` on virtual URIs, which requires `BaseContentProvider` to be registered first. Added explicit activation ordering requirement to design.

Additional suggestions incorporated: use `git merge-base` SHA instead of branch name for base ref, add error handling paths for `DiffPanelManager.open()/refresh()`, command-driven lifecycle for `hasDiffPanel` context key, hide `openDiffFile` from Command Palette.
