# Tasks: VS Code Diff Panel with Inline Review

## Phase 1: Foundation Modules

### T-1: BaseContentProvider + diffParser + serverClient.getDiff [x]

**Why**: Foundation modules needed before the diff panel can open. BaseContentProvider serves old-side file content via `git show`, diffParser extracts file list from unified diff headers, and serverClient needs a getDiff() method.

**Files**:

- `apps/vscode/src/baseContentProvider.ts` -- (new) TextDocumentContentProvider for `local-review-base:` scheme + EmptyContentProvider for `local-review-empty:` scheme. Uses `git merge-base HEAD main` for ref resolution, caches content per path.
- `apps/vscode/src/diffParser.ts` -- (new) Lightweight parser: `parseDiffFileList(unifiedDiff)` extracting file paths and A/M/D/R status from `diff --git` headers.
- `apps/vscode/src/serverClient.ts` -- (modified) Add `getDiff(worktreePath)` method calling `GET /api/diff?worktree=...`.

**Verify**:

- `pnpm -C apps/vscode type-check` passes ✓

---

## Phase 2: Diff Panel + CommentManager Updates

### T-2: DiffPanelManager + ChangedFilesTree + package.json + extension wiring [x]

**Why**: The main orchestrator that fetches diff, populates sidebar tree, opens native diff tabs.

**Files**:

- `apps/vscode/src/diffPanelManager.ts` -- (new) Orchestrates: open/refresh/close diff panel, file navigation via vscode.diff command
- `apps/vscode/src/changedFilesTree.ts` -- (new) TreeDataProvider for sidebar with status icons and thread count badges
- `apps/vscode/package.json` -- (modified) Commands, viewsContainers, views, menus
- `apps/vscode/src/extension.ts` -- (modified) Content provider registration before CommentManager, diff panel commands, thread count updates

**Verify**:

- `pnpm -C apps/vscode type-check` passes ✓
- `pnpm -C apps/vscode build` produces dist/extension.js ✓

---

### T-3: CommentManager old-side support — virtual URI routing + bidirectional comments [x]

**Why**: R4/R5 — users need to see and create comments on both old and new sides of the diff.

**Files**:

- `apps/vscode/src/commentManager.ts` -- (modified) Three changes:
  1. commentingRangeProvider: filter by scheme (file + local-review-base)
  2. \_createVSCodeThread: remove old-side skip, route to virtual URIs
  3. \_buildNewThread: detect virtual URI scheme → set side="old"

**Verify**:

- `pnpm -C apps/vscode type-check` passes ✓
- `pnpm -C apps/vscode build` produces dist/extension.js ✓
