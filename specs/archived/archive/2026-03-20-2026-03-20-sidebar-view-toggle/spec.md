# Sidebar View Toggle: Tree / Flat / Compact-Tree

## Motivation

Both the VS Code extension sidebar and the browser UI file sidebar display changed files, but neither supports the full range of view modes users expect from a code review tool:

- **VS Code extension**: The `Local Review: Changed Files` panel now lives inside the native Source Control sidebar (alongside `Local Review: Threads`), but renders a flat list only -- no folder grouping.
- **Browser UI**: Has a tree toggle, but every single path segment creates a separate tree level, making deeply nested single-child folders (e.g., `src/components/sidebar/`) painfully verbose. The toggle is an unstyled checkbox with no persistence.

VS Code's own SCM panel already supports tree/flat/compact-tree toggles for its built-in git changes. Our `Local Review: Changed Files` panel, now co-located in the same SCM sidebar, should offer the same view modes for consistency.

## User Stories

1. **As a reviewer using VS Code**, I want to toggle between flat and tree views in the changed files sidebar so I can navigate files by folder structure when the diff is large.
2. **As a reviewer using VS Code**, I want single-child folder chains collapsed (e.g., `src/utils` as one node) so the tree is not needlessly deep.
3. **As a reviewer using the browser UI**, I want compact folders in tree mode so deeply nested paths do not waste vertical space.
4. **As a reviewer**, I want my view mode preference remembered across sessions (localStorage for browser, workspaceState for VS Code).
5. **As a reviewer using the browser UI**, I want a polished toggle control (icon buttons, not a checkbox) that matches the sidebar's visual style.

## Requirements

### Functional

| ID  | Requirement                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | VS Code `Local Review: Changed Files` panel (in SCM sidebar) supports three modes: **flat**, **tree**, **compact-tree** (default: flat)                                                  |
| F2  | VS Code `localReview.changedFiles` view title bar shows a toggle icon that cycles: flat -> tree -> compact-tree -> flat                                                                  |
| F3  | VS Code uses `workspaceState` to persist the selected mode                                                                                                                               |
| F4  | VS Code tree mode groups files into folder `TreeItem` nodes with `Expanded` state (all folders open by default for review visibility)                                                    |
| F5  | VS Code compact-tree mode merges single-child folder chains into one node (label: `src/utils`)                                                                                           |
| F6  | Browser UI tree mode supports compact folders (merging single-child folder chains)                                                                                                       |
| F7  | Browser UI replaces the checkbox toggle with a segmented icon button group (flat / tree / compact-tree)                                                                                  |
| F8  | Browser UI persists view mode to `localStorage` under key `localReview.fileViewMode`                                                                                                     |
| F9  | Both surfaces use the same compact-folders algorithm: merge consecutive folder nodes that have exactly one child (which is also a folder) into a single display node with a joined label |

### Non-Functional

| ID  | Requirement                                                                  |
| --- | ---------------------------------------------------------------------------- |
| NF1 | Tree rebuild is O(n) where n = number of files -- no quadratic path scanning |
| NF2 | No new runtime dependencies for VS Code extension                            |
| NF3 | Browser UI reuses `@headless-tree/core` -- no new tree library               |

## Acceptance Criteria

1. In VS Code, clicking the view toggle icon cycles through flat / tree / compact-tree; each mode renders correctly.
2. In VS Code, reloading the window preserves the last selected mode.
3. In VS Code tree mode, folders are expandable/collapsible; clicking a file opens the diff.
4. In VS Code compact-tree mode, `src/components/sidebar` (if all single-child) renders as one tree node labeled `src/components/sidebar`.
5. In the browser UI, the segmented toggle shows three states; compact-tree mode collapses single-child chains.
6. In the browser UI, refreshing the page preserves the view mode.
7. Thread count badges still display correctly on file nodes in all three modes (VS Code and browser).
8. Folder nodes in VS Code show aggregate thread counts for contained files.

## Out of Scope

- Sorting options within tree/flat views (separate feature).
- File filtering / search within the sidebar.
- Drag-and-drop reordering.

## Alternatives Considered

| Alternative                                        | Why Rejected                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Two modes only (flat + compact-tree, no pure tree) | Some users prefer seeing every folder level explicitly; three modes matches VS Code SCM behavior |
| Shared npm package for compact-folders algorithm   | Over-engineering for ~30 lines of pure logic; duplicate with identical algorithm is simpler      |
| VS Code `TreeView` with `showCollapseAll` only     | Does not address view mode toggle or compact folders                                             |
