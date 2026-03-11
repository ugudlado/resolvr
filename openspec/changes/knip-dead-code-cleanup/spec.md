# Spec: Knip Dead Code Cleanup

mode: non-tdd

## Goal

Achieve zero knip findings by removing all dead code, unused dependencies, and fixing configuration issues. Establish a clean baseline so `pnpm knip` serves as an effective quality gate.

## Requirements

### R1: Delete Unused Files (18 files)

Delete the following files from `apps/ui/src/`:

| File                                       | Category | Replaced By            |
| ------------------------------------------ | -------- | ---------------------- |
| `components/diff/DiffTable.tsx`            | diff     | `@git-diff-view/react` |
| `components/diff/DiffViewSpike.tsx`        | diff     | Spike file, not used   |
| `components/diff/FullFileView.tsx`         | diff     | `DiffViewWrapper.tsx`  |
| `components/diff/HunkExpandRow.tsx`        | diff     | `@git-diff-view/react` |
| `components/diff/UnifiedFileView.tsx`      | diff     | `DiffViewWrapper.tsx`  |
| `components/review/ActivityPanel.tsx`      | review   | Replaced in redesign   |
| `components/review/CodeThreadsPanel.tsx`   | review   | Replaced in redesign   |
| `components/review/ReviewToolbar.tsx`      | review   | Replaced in redesign   |
| `components/shared/EmptyState.tsx`         | shared   | Not used               |
| `components/shared/ThreadStatusTabs.tsx`   | shared   | Not used               |
| `components/spec/AnnotatableParagraph.tsx` | spec     | Replaced in redesign   |
| `components/spec/DiagramsSection.tsx`      | spec     | Replaced in redesign   |
| `components/spec/DiagramToolbar.tsx`       | spec     | Replaced in redesign   |
| `components/spec/DrawioDiagram.tsx`        | spec     | Replaced in redesign   |
| `components/tasks/PhaseCard.tsx`           | tasks    | Replaced in redesign   |
| `components/tasks/TaskBoard.tsx`           | tasks    | Replaced in redesign   |
| `hooks/useThreadPartition.ts`              | hooks    | Not used               |
| `utils/tasksParser.ts`                     | utils    | Not used               |

### R2: Remove Unused Dependencies

From `apps/ui/package.json` — remove these **dependencies**:

- `@anthropic-ai/claude-agent-sdk` (server has its own copy)
- `@fontsource/geist-mono` — **KEEP** (CSS `@import`, false positive)
- `@fontsource/geist-sans` — **KEEP** (CSS `@import`, false positive)
- `immer` (zero imports)
- `rehype-autolink-headings` (zero imports)
- `rehype-highlight` (zero imports)
- `rehype-slug` (zero imports)
- `zustand` (zero imports)

From `apps/ui/package.json` — remove these **devDependencies**:

- `@testing-library/react` (no component tests use it)
- `@testing-library/user-event` (no component tests use it)
- `postcss-load-config` (zero imports)

From root `package.json` — remove this **devDependency**:

- `@anthropic-ai/claude-agent-sdk` (server workspace has its own)

### R3: Trim Unused Exports (12 exports)

Remove the `export` keyword (keep the function/component):

| Export                     | File                                  |
| -------------------------- | ------------------------------------- |
| `default` (duplicate)      | `components/diff/DiffViewWrapper.tsx` |
| `ThreadDisplay`            | `components/diff/ThreadWidget.tsx`    |
| `DiffSkeleton`             | `components/shared/Skeleton.tsx`      |
| `SidebarSkeleton`          | `components/shared/Skeleton.tsx`      |
| `ThreadSkeleton`           | `components/shared/Skeleton.tsx`      |
| `useIsThreadResolving`     | `hooks/useResolveStatus.ts`           |
| `hunkDomId`                | `utils/diffUtils.ts`                  |
| `canonicalSessionFileName` | `utils/diffUtils.ts`                  |
| `isLineInSelection`        | `utils/diffUtils.ts`                  |
| `threadAnchorKey`          | `utils/diffUtils.ts`                  |
| `threadRangeLabel`         | `utils/diffUtils.ts`                  |
| `buildFolderRows`          | `utils/diffUtils.ts`                  |

### R4: Trim Unused Exported Types (3 types)

Remove the `export` keyword (keep the type):

| Type            | File                         |
| --------------- | ---------------------------- |
| `ReviewSession` | `services/localReviewApi.ts` |
| `FeatureTab`    | `types/constants.ts`         |
| `ThreadFilter`  | `types/sessions.ts`          |

### R5: Fix Duplicate Export (1)

In `components/diff/DiffViewWrapper.tsx`: remove the `default` export, keep the named `DiffViewWrapper` export.

### R6: Clean knip.json

- Remove redundant entry patterns (per config hints)
- Add `ignoreDependencies` for `@fontsource/geist-mono` and `@fontsource/geist-sans`

## Acceptance Criteria

- `pnpm knip` exits with 0 (no findings)
- `pnpm type-check` passes
- `pnpm lint` passes
- `pnpm -C apps/ui build` succeeds
- `pnpm -C apps/server build` succeeds

## Non-Goals

- No new features or behavior changes
- No test additions (non-TDD mode, pure deletion)
- No refactoring beyond what knip identifies
