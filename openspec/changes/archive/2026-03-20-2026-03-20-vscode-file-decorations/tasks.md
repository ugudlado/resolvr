# Tasks: VS Code File Decorations

## Phase 1: Core Implementation

- [x] T-1 Extend `DiffFileEntry` with `additions`/`deletions` fields and update `parseDiffFileList` to count `+`/`-` lines per file from hunk content. Create `fileDecorationProvider.ts` with `ReviewFileDecorationProvider` class implementing status-to-color mapping using `gitDecoration.*` theme colors and `local-review-file:` URI scheme.
- [x] T-2 Update `changedFilesTree.ts` — add `resourceUri` with `local-review-file:` scheme, show diff stats in description (`+N/−M` format alongside directory path and thread count). Wire decoration provider into `diffPanelManager.ts` — register provider, call `setFiles()`/`clear()` on open/close lifecycle, clear before fetch to prevent stale badges.

<!-- Status markers: [ ] pending, [→] in-progress, [x] done -->
