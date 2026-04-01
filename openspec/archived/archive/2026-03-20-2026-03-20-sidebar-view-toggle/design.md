# Design: Sidebar View Toggle

## Current Architecture Context

The VS Code extension's panels have been migrated from a custom activity bar container to the native **Source Control (`scm`) sidebar**:

- `localReview.changedFiles` — Changed Files tree (view ID unchanged)
- `localReview.threads` — Threads tree (grouped by status)

Both are registered under `"views": { "scm": [...] }` in `package.json`. The orphaned custom `viewsContainers.activitybar` entry should be removed as cleanup.

The toggle icons will appear in the `localReview.changedFiles` view title bar within the SCM sidebar, alongside the existing refresh button.

## Approach

Three view modes -- **flat**, **tree**, **compact-tree** -- implemented independently in VS Code and browser UI, with the compact-folders algorithm duplicated (identical logic, ~30 lines, not worth a shared package given different runtimes and type systems).

## View Mode Type

Both surfaces use the same union type conceptually:

```ts
type FileViewMode = "flat" | "tree" | "compact-tree";
```

## Compact-Folders Algorithm

The algorithm operates as a post-processing pass on an already-built folder tree. It walks the tree and merges any folder node whose only child is another folder node into a single node with a joined path label.

```
Input tree:
  src/
    components/
      sidebar/
        FileSidebar.tsx
        OverviewTab.tsx
      diff/
        DiffTable.tsx

After compact-folders:
  src/components/
    sidebar/
      FileSidebar.tsx
      OverviewTab.tsx
    diff/
      DiffTable.tsx
```

### Algorithm (pseudocode)

```
function compactFolders(node):
  if node is a file: return node

  // Recurse first so children are already compacted
  node.children = node.children.map(compactFolders)

  // Merge: if this folder has exactly one child and that child is a folder
  while node.children.length == 1 AND node.children[0] is folder:
    child = node.children[0]
    node.label = node.label + "/" + child.label
    node.folderPath = child.folderPath  // use the deepest folder's path for expand/collapse
    node.children = child.children

  return node
```

Key properties:

- O(n) where n = total nodes (each node visited once)
- Preserves file ordering within folders
- The merged node's `folderPath` uses the deepest folder segment so expand/collapse state maps correctly
- Only merges folders, never absorbs a file into a folder label

## VS Code Extension Changes

### New Types (`apps/vscode/src/changedFilesTree.ts`)

```ts
type FileViewMode = "flat" | "tree" | "compact-tree";

/** Union type for tree elements -- either a folder or a file */
type TreeNode = FolderNode | DiffFileItem;

interface FolderNode {
  kind: "folder";
  label: string; // display label, e.g., "src/components" in compact mode
  folderPath: string; // full path used as unique ID
  children: TreeNode[];
  openThreads: number; // aggregate of all descendant files
}
```

`DiffFileItem` gains `kind: "file"` discriminant field.

### TreeDataProvider Rewrite

`ChangedFilesTreeProvider` becomes `TreeDataProvider<TreeNode>` (union of `FolderNode | DiffFileItem`):

```ts
class ChangedFilesTreeProvider implements TreeDataProvider<TreeNode> {
  private _mode: FileViewMode = "flat";
  private _files: DiffFileItem[] = [];
  private _rootChildren: TreeNode[] = [];  // computed on mode/file change

  setMode(mode: FileViewMode): void { ... rebuild ... }
  setFiles(files: DiffFileEntry[]): void { ... rebuild ... }

  private _rebuild(): void {
    switch (this._mode) {
      case "flat":
        this._rootChildren = this._files;
        break;
      case "tree":
        this._rootChildren = buildFolderTree(this._files);
        break;
      case "compact-tree":
        this._rootChildren = compactFolders(buildFolderTree(this._files));
        break;
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): TreeItem {
    if (element.kind === "folder") {
      // Folder node with collapse state
      const item = new TreeItem(element.label, TreeItemCollapsibleState.Expanded);
      item.iconPath = ThemeIcon.Folder;
      item.contextValue = "folder";
      if (element.openThreads > 0) {
        item.description = `${element.openThreads} comment${element.openThreads > 1 ? "s" : ""}`;
      }
      return item;
    }
    // File node -- same as current getTreeItem but without directory description in tree modes
    ...
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) return this._rootChildren;
    if (element.kind === "folder") return element.children;
    return [];
  }

  getParent(element: TreeNode): TreeNode | undefined {
    // Walk the tree to find parent. Required for reveal() support.
    // Build a parent map during _rebuild for O(1) lookup.
    return this._parentMap.get(element);
  }
}
```

### `buildFolderTree` Helper

Converts flat `DiffFileItem[]` into a `TreeNode[]` hierarchy:

1. Sort files by path (ensures folder grouping is stable).
2. For each file, split path on `/`, create intermediate `FolderNode`s as needed.
3. Return the root-level children.

This is the same algorithm the browser UI already uses in its `treeData` useMemo, adapted for VS Code's type system.

### `compactFolders` Helper

Post-processing pass as described in the algorithm section. Applied to the output of `buildFolderTree`.

### package.json Changes

New commands:

```json
{
  "command": "local-review.viewAsTree",
  "title": "Local Review: View as Tree",
  "icon": "$(list-tree)"
},
{
  "command": "local-review.viewAsFlat",
  "title": "Local Review: View as Flat List",
  "icon": "$(list-flat)"
},
{
  "command": "local-review.viewAsCompactTree",
  "title": "Local Review: View as Compact Tree",
  "icon": "$(list-tree)"
}
```

Menu contributions (view/title):

```json
{
  "command": "local-review.viewAsTree",
  "when": "view == localReview.changedFiles && local-review.hasDiffPanel && local-review.fileViewMode == flat",
  "group": "navigation"
},
{
  "command": "local-review.viewAsCompactTree",
  "when": "view == localReview.changedFiles && local-review.hasDiffPanel && local-review.fileViewMode == tree",
  "group": "navigation"
},
{
  "command": "local-review.viewAsFlat",
  "when": "view == localReview.changedFiles && local-review.hasDiffPanel && local-review.fileViewMode == compact-tree",
  "group": "navigation"
}
```

This pattern shows one icon at a time that advances to the next mode (flat -> tree -> compact-tree -> flat), matching VS Code SCM's toggle UX. The `when` clause uses a context key `local-review.fileViewMode` set via `setContext`.

Command palette visibility -- hide the mode commands from palette since they only make sense as view title actions:

```json
{
  "command": "local-review.viewAsTree",
  "when": "false"
},
{
  "command": "local-review.viewAsFlat",
  "when": "false"
},
{
  "command": "local-review.viewAsCompactTree",
  "when": "false"
}
```

### State Persistence

In `DiffPanelManager` (or extension activation):

```ts
// Runtime validation — guards against corrupted persisted values
const VALID_MODES: FileViewMode[] = ["flat", "tree", "compact-tree"];
function parseFileViewMode(raw: unknown): FileViewMode {
  return typeof raw === "string" && VALID_MODES.includes(raw as FileViewMode)
    ? (raw as FileViewMode)
    : "flat";
}

// Read on activation
const mode = parseFileViewMode(
  context.workspaceState.get<string>("fileViewMode"),
);
treeProvider.setMode(mode);
vscode.commands.executeCommand("setContext", "local-review.fileViewMode", mode);

// On toggle command
function cycleMode(current: FileViewMode): FileViewMode {
  const next: Record<FileViewMode, FileViewMode> = {
    flat: "tree",
    tree: "compact-tree",
    "compact-tree": "flat",
  };
  return next[current];
}
```

### `getFirstFile` in Tree Modes

`getFirstFile()` must return the first **file** node in DFS tree traversal order (not `_files[0]`), since tree/compact-tree modes sort by path. `DiffPanelManager.open()` already calls `treeProvider.getFirstFile()` — the implementation just needs to walk `_rootChildren` recursively to find the first leaf file node.

### Thread Count Aggregation

`updateThreadCounts` must now aggregate counts up the folder tree:

1. Set per-file counts as today.
2. Walk the tree bottom-up, summing `openThreads` from children into each `FolderNode`.
3. Fire `onDidChangeTreeData`.

### File Description in Tree Modes

In **flat** mode, the file item description shows the directory path (current behavior). In **tree** and **compact-tree** modes, the directory is already represented by the folder hierarchy, so the file item description shows only the thread count (if any).

## Browser UI Changes

### View Mode State (`apps/ui/src/pages/ReviewPage.tsx`)

Replace:

```ts
const [showFolderTree, setShowFolderTree] = useState(false);
```

With:

```ts
// Reuse the same parseFileViewMode helper as VS Code (duplicated, ~5 lines)
const [fileViewMode, setFileViewMode] = useState<FileViewMode>(() => {
  return parseFileViewMode(localStorage.getItem("localReview.fileViewMode"));
});

useEffect(() => {
  localStorage.setItem("localReview.fileViewMode", fileViewMode);
}, [fileViewMode]);
```

The `showFolderTree` prop on `FileSidebar` becomes `fileViewMode: FileViewMode` and `onFileViewModeChange: (mode: FileViewMode) => void`.

### Compact Folders in Tree Data (`apps/ui/src/components/sidebar/FileSidebar.tsx`)

The existing `treeData` useMemo builds the folder hierarchy. Add a second pass for compact mode:

```ts
const treeData = useMemo(() => {
  const items = buildTreeItems(visibleFiles); // existing logic, extracted
  if (fileViewMode === "compact-tree") {
    return applyCompactFolders(items);
  }
  return items;
}, [visibleFiles, fileViewMode]);
```

`applyCompactFolders` merges single-child folder entries in the `Record<string, TreeItem>` map:

1. For each folder whose `children` array has exactly one entry and that entry is also a folder:
   - Merge: new label = `parent.name + "/" + child.name`, new children = child's children.
   - Remove the child folder key from the map.
   - Update parent references.
2. Process bottom-up in a single pass (post-order DFS) to satisfy NF1's O(n) requirement. Do **not** use "repeat until stable" which risks O(n²) on deep chains.

The `TreeItem` type already has `name: string` for display, so merged folders get a joined name like `src/components`.

### Toggle UI

Replace the checkbox with a three-button segmented control in the Files header bar:

```tsx
<div role="radiogroup" aria-label="File view mode" className="flex items-center gap-0.5">
  <button
    role="radio"
    aria-checked={fileViewMode === "flat"}
    aria-label="Flat list"
    title="Flat list"
    onClick={() => onFileViewModeChange("flat")}
    className={`rounded p-0.5 text-[11px] ${fileViewMode === "flat" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
  >
    {/* list-flat SVG icon */}
  </button>
  <button role="radio" aria-checked={fileViewMode === "tree"} aria-label="Tree" title="Tree" ...>
    {/* list-tree SVG icon */}
  </button>
  <button role="radio" aria-checked={fileViewMode === "compact-tree"} aria-label="Compact tree" title="Compact tree" ...>
    {/* compact-tree SVG icon */}
  </button>
</div>
```

Icons: Use small inline SVG icons matching VS Code codicons (no icon library dependency). Three distinct shapes:

- **Flat**: three horizontal lines (hamburger) — `≡` or codicon `list-flat`
- **Tree**: branching tree lines — codicon `list-tree`
- **Compact tree**: tree with compressed node indicator — codicon `list-tree` with a subtle dot/merge indicator

### Props Change Summary

`FileSidebar`:

- Remove: `showFolderTree: boolean`, `onFolderTreeChange: (v: boolean) => void`
- Add: `fileViewMode: FileViewMode`, `onFileViewModeChange: (mode: FileViewMode) => void`

Callers (`ReviewPage.tsx`, any other consumer) updated accordingly.

## Data Flow

### VS Code

```
User clicks toggle icon
  -> command handler reads current mode from context
  -> computes next mode (flat -> tree -> compact-tree -> flat)
  -> calls treeProvider.setMode(nextMode)
  -> saves to workspaceState
  -> sets context key for menu when-clause
  -> treeProvider._rebuild() fires onDidChangeTreeData
  -> VS Code re-renders tree view
```

### Browser UI

```
User clicks segment button
  -> onFileViewModeChange(mode) called
  -> ReviewPage setState + localStorage.setItem
  -> FileSidebar receives new fileViewMode prop
  -> treeData useMemo recomputes (applies compact if needed)
  -> @headless-tree re-renders with new data
```

## Error Handling

- **Empty file list**: All three modes render "No changed files" message -- no special handling needed.
- **Invalid persisted value**: If localStorage/workspaceState contains an unrecognized string, fall back to `"flat"`.
- **Compact-tree with no collapsible chains**: Renders identically to full tree mode -- no edge case.

## File Change Summary

| File                                             | Change                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/vscode/src/changedFilesTree.ts`            | Rewrite to support `TreeNode` union, folder nodes, three modes, compact algorithm                                        |
| `apps/vscode/src/diffPanelManager.ts`            | Pass `ExtensionContext` for workspaceState; register toggle commands; set context keys                                   |
| `apps/vscode/src/extension.ts`                   | Register new commands, pass context to DiffPanelManager                                                                  |
| `apps/vscode/package.json`                       | Add 3 commands, menu contributions with when-clauses, commandPalette hiding; remove orphaned viewsContainers.activitybar |
| `apps/ui/src/components/sidebar/FileSidebar.tsx` | New props, compact-folders algorithm, segmented toggle UI                                                                |
| `apps/ui/src/pages/ReviewPage.tsx`               | Replace `showFolderTree` state with `fileViewMode` + localStorage persistence                                            |
| `apps/ui/src/types/` (optional)                  | Shared `FileViewMode` type if used across multiple UI files                                                              |
