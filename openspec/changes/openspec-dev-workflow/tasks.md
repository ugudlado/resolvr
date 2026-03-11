# Tasks: Enable Dev Workflow & OpenSpec Artifact Review

## Phase 1: Server — Path Resolution & Parser Fix

- [ ] T-1 Update `features.ts`: switch specMdPath and tasksMdPath from `specs/active/{id}/` to `openspec/changes/{id}/`
- [ ] T-2 Update `features.ts`: check for proposal.md and design.md existence, set hasSpec=true if any openspec artifact exists
- [ ] T-3 Update `features.ts`: fix `parseTaskProgress()` regex to accept `T-N` format (`/- \[[x→~ ]\] T-?\d+/gi`)
- [ ] T-4 Update `features.ts`: include proposal.md and design.md in `getLastActivity()` path list
- [ ] T-5 Update `tasks.ts`: switch tasks.md resolution from `specs/active/{id}/` to `openspec/changes/{id}/`
- [ ] T-6 Update `tasks.ts`: fix `parseTasksMarkdown()` to accept `## Phase` headings (not just `###`) and `T-N` task IDs (not just `TN:`)
- [ ] T-7 Fix `tasks.ts` archived fallback: remove double-nested `{featureId}/{featureId}` path bug
- [ ] T-8 Update `deriveFeatureStatus()`: remove spec session dependency, use hasOpenspecArtifacts for design status
- [ ] T-9 Review checkpoint (phase gate)

## Phase 2: UI — Enable Dev Workflow & Fix /spec References

- [ ] T-10 Set `FLAGS.DEV_WORKFLOW = true` in `apps/ui/src/config/app.ts`
- [ ] T-11 Remove "Spec" entry from tabs array in `FeatureNavBar.tsx`, remove spec thread count badge [P]
- [ ] T-12 Fix `FeatureNavBar.tsx` `defaultFallbackTab`: change fallback from `"spec"` to `"code"` [P]
- [ ] T-13 Remove SpecReviewPage route from `App.tsx`, update FeatureDefaultRedirect to use Code tab as fallback (not FEATURE_TAB.Spec) [P]
- [ ] T-14 Update `featureStatus.ts`: change defaultTab from "spec" to "code" for new/design/design_review statuses [P]
- [ ] T-15 Update `FeatureCard.tsx`: change dashboard quick action link from `/spec` to `/code` (or remove Spec action) [P]
- [ ] T-16 Run `pnpm knip` and remove dead exports/imports from SpecReviewPage and related spec components to pass knip checks
- [ ] T-17 Review checkpoint (phase gate)

## Phase 3: Build & Integration Verification

- [ ] T-18 Build UI and server bundles, verify no build errors or type errors
- [ ] T-19 Start dev server with a feature worktree containing openspec artifacts, verify Dashboard shows feature
- [ ] T-20 Verify Code tab displays openspec files in sidebar and renders content with annotations
- [ ] T-21 Verify Tasks tab correctly parses progress from openspec/changes/{id}/tasks.md (with `## Phase` + `T-N` format)
- [ ] T-22 Verify archived features at specs/archived/ still appear on Dashboard
- [ ] T-23 Verify no dead links — clicking design-phase features from Dashboard lands on Code tab
- [ ] T-24 Run `pnpm knip` — verify no dead code violations
- [ ] T-25 Review checkpoint (phase gate)
