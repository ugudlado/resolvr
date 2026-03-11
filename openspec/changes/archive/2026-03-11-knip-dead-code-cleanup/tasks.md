# Tasks: Knip Dead Code Cleanup

## Phase 1: Cleanup (single phase)

### T01: Clean knip.json configuration [x]

- [x] Remove redundant `src/index.ts` entry pattern for `apps/server`
- [x] Remove redundant `src/main.tsx` entry pattern for `apps/ui`
- [x] Add `ignoreDependencies` array with `@fontsource/geist-mono` and `@fontsource/geist-sans`
- **Done when**: knip.json has no redundant entries and fontsource packages are ignored

### T02: Remove unused dependencies [x]

- [x] Remove from `apps/ui/package.json` dependencies: `@anthropic-ai/claude-agent-sdk`, `immer`, `rehype-autolink-headings`, `rehype-highlight`, `rehype-slug`, `zustand`
- [x] Remove from `apps/ui/package.json` devDependencies: `@testing-library/react`, `@testing-library/user-event`, `postcss-load-config`
- [x] Remove from root `package.json` devDependencies: `@anthropic-ai/claude-agent-sdk`
- [x] Run `pnpm install` to update lockfile
- **Done when**: Removed packages no longer appear in package.json files and lockfile is updated

### T03: Delete unused files [x]

- [x] Delete 5 diff components: `DiffTable.tsx`, `DiffViewSpike.tsx`, `FullFileView.tsx`, `HunkExpandRow.tsx`, `UnifiedFileView.tsx`
- [x] Delete 3 review components: `ActivityPanel.tsx`, `CodeThreadsPanel.tsx`, `ReviewToolbar.tsx`
- [x] Delete 2 shared components: `EmptyState.tsx`, `ThreadStatusTabs.tsx`
- [x] Delete 4 spec components: `AnnotatableParagraph.tsx`, `DiagramsSection.tsx`, `DiagramToolbar.tsx`, `DrawioDiagram.tsx`
- [x] Delete 2 task components: `PhaseCard.tsx`, `TaskBoard.tsx`
- [x] Delete 1 hook: `useThreadPartition.ts`
- [x] Delete 1 util: `tasksParser.ts`
- [x] Also deleted: `ThreadCard.tsx` (became unused after ThreadDisplay removed), `apps/ui/src/server/resolver-daemon.ts` (dead UI copy)
- **Done when**: All 18+ files are deleted

### T04: Trim unused exports and fix duplicate export [x]

- [x] Remove `export default` from `DiffViewWrapper.tsx` (keep named export)
- [x] Remove `export` from `ThreadDisplay` in `ThreadWidget.tsx` (deleted - unused)
- [x] Remove `export` from `DiffSkeleton`, `SidebarSkeleton`, `ThreadSkeleton` in `Skeleton.tsx` (deleted - unused)
- [x] Remove `export` from `useIsThreadResolving` in `useResolveStatus.ts` (deleted - unused)
- [x] Remove `export` from `hunkDomId`, `canonicalSessionFileName`, `isLineInSelection`, `threadAnchorKey`, `threadRangeLabel`, `buildFolderRows` in `diffUtils.ts` (deleted - unused)
- [x] Remove `export` from `ReviewSession` type in `localReviewApi.ts` (deleted - unused)
- [x] Remove `export` from `FeatureTab` type in `constants.ts` (deleted - unused)
- [x] Remove `export` from `ThreadFilter` type in `types/sessions.ts` (deleted - unused)
- **Done when**: All 15 exports are no longer exported (functions/types still exist for internal use)

### T05: Rebuild and verify [x]

- [x] Run `pnpm -C apps/ui build` — ✓ built in 1.82s
- [x] Run `pnpm -C apps/server build` — ✓ built in 19ms
- [x] Run `pnpm type-check` — ✓ passes
- [x] Run `pnpm lint` — ✓ 0 errors, 6 pre-existing warnings
- [x] Run `pnpm knip` — ✓ exits 0 with no findings
- **Done when**: All checks pass with zero errors and zero knip findings
