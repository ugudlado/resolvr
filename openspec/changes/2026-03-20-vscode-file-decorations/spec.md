# Spec: VS Code File Decorations

**mode**: non-tdd
**feature-id**: 2026-03-20-vscode-file-decorations
**linear-ticket**: none

## Motivation

The changed files tree view currently uses generic ThemeIcon icons (diff-added, diff-removed, etc.) to indicate file status. While functional, this doesn't match the visual language VS Code users expect from SCM-style views like the Git Changes panel, which uses colored letter badges (M, A, D, R) with semantic colors. Additionally, the tree provides no at-a-glance information about the size of changes per file (insertions/deletions), forcing users to open each diff to understand scope.

## Requirements

### Functional

1. **Status badge decorations**: Each file in the changed files tree displays a single-character badge indicating its status:
   - `A` (added) with green foreground (`gitDecoration.addedResourceForeground`)
   - `D` (deleted) with red foreground (`gitDecoration.deletedResourceForeground`)
   - `M` (modified) with yellow/blue foreground (`gitDecoration.modifiedResourceForeground`)
   - `R` (renamed) with teal foreground (`gitDecoration.renamedResourceForeground`)

2. **Diff stats in description**: Each file's TreeItem description includes insertion/deletion counts in the format `+N/−M`, placed between the directory path and the thread count. Example: `src/components +12/−3 · 2 comments`. Stats are omitted when `additions + deletions === 0` (pure renames or mode-only changes).

3. **Decoration lifecycle**: Decorations appear when the diff panel is opened and clear when it is closed. Refreshing the diff panel updates decorations to reflect the current state. Decorations must also be cleared on early-return paths (empty diff, fetch failure) to prevent stale badges from a previous load.

4. **Decoration scoping**: Decorations apply only to the changed files tree view, not to files in the Explorer or other panels.

### Non-Functional

1. **Theme compliance**: All decoration colors use VS Code's built-in `gitDecoration.*` theme colors so they adapt to any installed color theme.
2. **Performance**: Diff stats parsing adds negligible overhead since the unified diff is already fetched and available in memory.
3. **No manifest changes**: FileDecorationProvider does not require `package.json` contributions.

## Architecture

### Component Changes

1. **`diffParser.ts`** -- Extend `DiffFileEntry` with `additions: number` and `deletions: number` fields. Modify `parseDiffFileList` to count `+`/`-` prefixed lines in hunk bodies (excluding `+++`/`---` header lines).

2. **`fileDecorationProvider.ts`** (new) -- A `FileDecorationProvider` implementation that maps a custom URI scheme (`local-review-file:`) to status-colored badges. Exposes `setFiles()` and `clear()` to update the decoration state.

3. **`changedFilesTree.ts`** -- Set `resourceUri` on TreeItems using the custom URI scheme so the decoration provider can match them. Incorporate diff stats (`+N/-M`) into the description string.

4. **`diffPanelManager.ts`** -- Create and register the decoration provider. Wire `setFiles()` and `clear()` calls to the diff panel open/close/refresh lifecycle.

### Data Flow

```
Server diff response
  -> parseDiffFileList() produces DiffFileEntry[] with additions/deletions
  -> DiffPanelManager.open() passes entries to:
     1. ChangedFilesTreeProvider.setFiles() -- builds TreeItems with resourceUri + stats description
     2. FileDecorationProvider.setFiles() -- builds decoration map, fires onDidChangeFileDecorations
  -> VS Code calls provideFileDecoration(uri) for each TreeItem's resourceUri
  -> FileDecorationProvider returns { badge, color, tooltip } based on file status
```

### URI Scheme

Custom scheme `local-review-file:` with path set to the file's display path. This ensures decorations are scoped to our tree view and do not bleed into the Explorer or other panels that use `file:` URIs.

URIs must be constructed via `Uri.from({ scheme: 'local-review-file', path: '/' + relativePath })` to safely handle paths with URI-special characters (`#`, `?`, `%`). The decoration map must key on the same normalized `uri.path` value.

Example: `local-review-file:/src/components/App.tsx`

## Acceptance Criteria

1. Opening the diff panel shows colored status badges (A/M/D/R) on each file in the tree, matching VS Code's native Git decoration colors.
2. Each file's description includes `+N/-M` diff stats when the file has hunks.
3. Closing the diff panel clears all decorations.
4. Refreshing the diff panel updates decorations and stats.
5. Decorations do not appear on files in the VS Code Explorer or other panels.
6. Colors adapt correctly when switching between light and dark themes (verified by using ThemeColor references, not hardcoded hex values).

## Alternatives Considered

1. **Real `file:` URIs for resourceUri**: Rejected because FileDecorationProvider is global -- decorations would appear on matching files in the Explorer sidebar, which is confusing and not desired.
2. **Inline badge via TreeItem label**: VS Code TreeItem labels don't support colored segments. Using description for the badge would sacrifice the directory path display.
3. **Separate stats column via TreeView columns API**: TreeView columns are still a proposed API (not stable). Using description is the pragmatic choice.

## Review Summary

Reviewed by `[codex]` via PAL MCP clink. All critical findings resolved:

- **[codex] critical — stale decorations on early return**: `open()` must clear decorations before fetching, so empty-diff and error paths don't leave stale badges. → Added to requirement F3 and design wiring section.
- **[codex] critical — URI-unsafe paths**: `Uri.parse()` mishandles `#`, `?`, `%` in filenames. → Changed to `Uri.from()` in spec URI section and design component 4.
- **[codex] critical — badge rendering assumption**: Design assumed badge placement without validation. → Removed `[ASSUMPTION]` tag, made decision explicit with fallback plan.
- **[codex] suggestion — separator inconsistency**: Spec used `.` but codebase uses `·`. → Unified to `·` throughout.
- **[codex] suggestion — zero-stat display**: Spec didn't explicitly cover `+0/-0`. → Added explicit omission rule for zero-stat files.
- **[codex] suggestion — thread count preservation**: `setFiles()` resets thread counts. → Pre-existing behavior; thread reconciliation via WebSocket runs independently after tree rebuild. No change needed.
- **[codex] nitpick — binary/mode-only diffs**: → Added to error handling in design.
