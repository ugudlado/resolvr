# Design: VS Code File Decorations

## Approaches Evaluated

### A. Decoration via TreeItem.iconPath customization

Extend the existing icon assignment to use custom SVG icons with colored badges baked in. Rejected: requires maintaining SVG assets, doesn't integrate with VS Code's theme system, and duplicates what FileDecorationProvider already provides natively.

### B. FileDecorationProvider with real file URIs

Set `resourceUri` to `vscode.Uri.file(workspaceRoot + '/' + path)` and register a FileDecorationProvider. Simple but fatally flawed: FileDecorationProvider is global, so decorations leak into the Explorer, Search results, and any other view that shows the same file URIs.

### C. FileDecorationProvider with custom URI scheme (selected)

Use a custom URI scheme (`local-review-file:`) for TreeItem.resourceUri. The decoration provider only matches URIs with this scheme, so decorations are naturally scoped to our tree view. This is the standard VS Code pattern used by extensions like GitLens and GitHub PR.

**Rationale**: Native API, theme-compatible colors, no asset management, properly scoped. Zero manifest changes needed.

## Component Breakdown

### 1. DiffFileEntry -- Extended Type

**File**: `apps/vscode/src/diffParser.ts`

Add two optional fields to the existing interface:

```typescript
export interface DiffFileEntry {
  path: string;
  oldPath: string;
  newPath: string;
  status: "A" | "M" | "D" | "R";
  additions: number; // new
  deletions: number; // new
}
```

Fields are required (not optional) since every parsed block can produce a count (0 for blocks with no hunks).

### 2. parseDiffFileList -- Stat Counting

**File**: `apps/vscode/src/diffParser.ts`

After determining status, iterate the block's lines to count hunk content lines:

- Lines starting with `+` (but NOT `+++`) count as additions
- Lines starting with `-` (but NOT `---`) count as deletions

This is the same algorithm `git diff --stat` uses internally. The lines are already in memory since we split on `^diff --git`.

### 3. FileDecorationProvider -- New Class

**File**: `apps/vscode/src/fileDecorationProvider.ts`

```typescript
class ReviewFileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChange = new EventEmitter<Uri | Uri[]>();
  onDidChangeFileDecorations = this._onDidChange.event;

  private _decorations = new Map<string, FileDecoration>();

  setFiles(files: DiffFileEntry[]): void {
    // Build map: path -> { badge, color, tooltip }
    // Fire onDidChangeFileDecorations with all URIs
  }

  clear(): void {
    // Clear map, fire change event for all previously-decorated URIs
  }

  provideFileDecoration(uri: Uri): FileDecoration | undefined {
    if (uri.scheme !== SCHEME_REVIEW_FILE) return undefined;
    return this._decorations.get(uri.path);
  }
}
```

**Status-to-decoration mapping**:

| Status | Badge | ThemeColor                                 | Tooltip             |
| ------ | ----- | ------------------------------------------ | ------------------- |
| A      | A     | `gitDecoration.addedResourceForeground`    | Added               |
| D      | D     | `gitDecoration.deletedResourceForeground`  | Deleted             |
| M      | M     | `gitDecoration.modifiedResourceForeground` | Modified            |
| R      | R     | `gitDecoration.renamedResourceForeground`  | Renamed: old -> new |

The `propagate` property is set to `false` since this is a flat tree (no parent folders to propagate to).

### 4. ChangedFilesTreeProvider -- resourceUri + Stats Description

**File**: `apps/vscode/src/changedFilesTree.ts`

Changes to `getTreeItem()`:

1. **Set resourceUri**: `item.resourceUri = vscode.Uri.from({ scheme: SCHEME_REVIEW_FILE, path: '/' + element.path })` — uses `Uri.from()` to safely handle paths with URI-special characters
2. **Keep iconPath**: VS Code FileDecoration badges render as a small colored suffix badge on the right side of tree items (same as SCM views), while ThemeIcon renders as the leading icon on the left. These serve different purposes — keep both. If during implementation testing the dual display feels redundant, the ThemeIcon can be removed as a follow-up.
3. **Stats in description**: Insert `+N/-M` between directory path and thread count.

Description format (uses `·` separator consistent with existing thread count display):

- No stats, no threads: `src/components`
- With stats, no threads: `src/components +12/−3`
- With stats and threads: `src/components +12/−3 · 2 comments`
- No stats (zero changes, e.g. rename-only), with threads: `src/components · 1 comment`

Omit stats when `additions + deletions === 0` (pure renames, mode changes, binary diffs).

### 5. DiffPanelManager -- Wiring

**File**: `apps/vscode/src/diffPanelManager.ts`

Changes:

1. **Constructor**: Create `ReviewFileDecorationProvider` instance. Register it via `vscode.window.registerFileDecorationProvider()` and store the disposable.
2. **open()**: Clear decorations at the top of the method (before any early returns). After `parseDiffFileList`, call `decorationProvider.setFiles(files)` alongside `treeProvider.setFiles(files)`. On error/empty-diff early returns, decorations are already cleared.
3. **close()**: Call `decorationProvider.clear()`.
4. **refresh()**: Calls `open()` which clears then rebuilds — no separate handling needed.
5. **dispose()**: Dispose the decoration provider registration.

## Data Flow

```
1. User triggers "Open Diff" command
2. DiffPanelManager.open() fetches unified diff from server
3. parseDiffFileList() parses headers AND hunk lines
   -> Returns DiffFileEntry[] with path, status, additions, deletions
4. DiffPanelManager passes entries to:
   a. ChangedFilesTreeProvider.setFiles()
      -> Builds TreeItems with resourceUri (local-review-file: scheme)
      -> Sets description with dir path + stats
   b. ReviewFileDecorationProvider.setFiles()
      -> Builds Map<path, FileDecoration>
      -> Fires onDidChangeFileDecorations
5. VS Code renders tree:
   a. Calls getTreeItem() -> gets label, description, iconPath, resourceUri
   b. Calls provideFileDecoration(resourceUri) -> gets badge + color
   c. Renders: [icon] filename  dir/path +12/-3   [M]  (badge colored)
6. User closes diff -> DiffPanelManager.close()
   -> decorationProvider.clear() removes all decorations
```

## Error Handling

- **No hunks in a diff block** (renames, mode changes, binary diffs): `additions` and `deletions` default to 0. Stats display is suppressed in the description.
- **Malformed diff blocks**: If a block has no parseable header match, it is skipped entirely (existing behavior). Stat counting only runs on successfully parsed blocks.
- **Decoration provider called for unknown URI**: `provideFileDecoration` returns `undefined`, which VS Code handles gracefully (no decoration shown).
- **Stale decorations**: `open()` calls `decorationProvider.clear()` before fetching, so early returns (empty diff, fetch failure) never leave stale badges.
- **Scheme collision**: The `local-review-file` scheme is unique to this extension. No collision risk with `local-review-base` or `local-review-empty` (already in use).

## Scope Boundaries

- **No folder grouping**: The tree remains flat. `propagate: false` means no folder-level decorations.
- **No stat caching**: Stats are recomputed on each refresh. The diff is already in memory so there's no performance concern.
- **No manifest changes**: FileDecorationProvider registration is purely runtime. No `package.json` contributions needed.
- **Existing icons preserved**: ThemeIcon assignment stays. The FileDecoration badge is additive, appearing as a suffix badge alongside the existing icon.
