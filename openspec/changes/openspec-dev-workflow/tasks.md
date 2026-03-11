# Tasks: Enable Dev Workflow & OpenSpec Artifact Review

## Phase 1: Server — Path Resolution & Parser Fix

- [x] T-1 Update `features.ts`: switch specMdPath and tasksMdPath from `specs/active/{id}/` to `openspec/changes/{id}/`
- [x] T-2 Update `features.ts`: check for proposal.md and design.md existence, set hasSpec=true if any openspec artifact exists
- [x] T-3 Update `features.ts`: fix `parseTaskProgress()` regex to accept `T-N` format (`/- \[[x→~ ]\] T-?\d+/gi`)
- [x] T-4 Update `features.ts`: include proposal.md and design.md in `getLastActivity()` path list
- [x] T-5 Update `tasks.ts`: switch tasks.md resolution from `specs/active/{id}/` to `openspec/changes/{id}/`
- [x] T-6 Update `tasks.ts`: fix `parseTasksMarkdown()` to accept `## Phase` headings (not just `###`) and `T-N` task IDs (not just `TN:`)
- [x] T-7 Fix `tasks.ts` archived fallback: remove double-nested `{featureId}/{featureId}` path bug
- [x] T-8 Update `deriveFeatureStatus()`: remove spec session dependency, use hasOpenspecArtifacts for design status
- [x] T-9 Review checkpoint (phase gate)

## Phase 2: UI — Enable Dev Workflow & Fix /spec References

- [x] T-10 Set `FLAGS.DEV_WORKFLOW = true` in `apps/ui/src/config/app.ts`
- [x] T-11 Remove "Spec" entry from tabs array in `FeatureNavBar.tsx`, remove spec thread count badge [P]
- [x] T-12 Fix `FeatureNavBar.tsx` `defaultFallbackTab`: change fallback from `"spec"` to `"code"` [P]
- [x] T-13 Remove SpecReviewPage route from `App.tsx`, update FeatureDefaultRedirect to use Code tab as fallback (not FEATURE_TAB.Spec) [P]
- [x] T-14 Update `featureStatus.ts`: change defaultTab from "spec" to "code" for new/design/design_review statuses [P]
- [x] T-15 Update `FeatureCard.tsx`: change dashboard quick action link from `/spec` to `/code` (or remove Spec action) [P]
- [x] T-16 Run `pnpm knip` and remove dead exports/imports from SpecReviewPage and related spec components to pass knip checks
- [x] T-17 Review checkpoint (phase gate)

## Phase 2b: Bug Fix — OpenSpec Change Directory Discovery

- [x] T-26 Fix `features.ts`: scan `openspec/changes/` directory to find the change matching the feature, instead of assuming `openspec/changes/{featureId}/` exists (the change dir uses a slug like `openspec-dev-workflow`, not the full feature ID `2026-03-12-openspec-dev-workflow`)
  - **Why**: Browser verification revealed the openspec change dir name (slug) doesn't match the worktree feature ID (date-prefixed). FR-3 requires feature discovery to find openspec artifacts.
  - **Files**: `apps/server/src/routes/features.ts`
  - **Done when**: API returns `hasSpec: true` and `hasTasks: true` for a worktree whose openspec change dir uses a slug
- [x] T-27 Fix `tasks.ts`: use same discovery logic to resolve tasks.md path from openspec change dir
  - **Why**: Same slug mismatch affects task loading. FR-4 requires tasks to be parsed.
  - **Files**: `apps/server/src/routes/tasks.ts`
  - **Done when**: `/api/features/:id/tasks` returns parsed tasks for the feature
- [x] T-28 Rebuild server bundle and verify API responses

## Phase 3: Build & Integration Verification

- [x] T-18 Build UI and server bundles, verify no build errors or type errors
- [x] T-19 Start dev server with a feature worktree containing openspec artifacts, verify Dashboard shows feature
- [x] T-20 Verify Code tab displays openspec files in sidebar and renders content with annotations
- [x] T-21 Verify Tasks tab correctly parses progress from openspec/changes/{id}/tasks.md (with `## Phase` + `T-N` format)
- [x] T-22 Verify archived features at specs/archived/ still appear on Dashboard
- [x] T-23 Verify no dead links — clicking design-phase features from Dashboard lands on Code tab
- [x] T-24 Run `pnpm knip` — verify no dead code violations
- [x] T-25 Review checkpoint (phase gate)
