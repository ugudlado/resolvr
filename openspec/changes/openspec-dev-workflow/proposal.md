# Proposal: Enable Dev Workflow & OpenSpec Artifact Review

## Why

The local-review app currently operates as a code-diff-only reviewer. A `FLAGS.DEV_WORKFLOW` feature flag gates the full pipeline (dashboard, feature navigation, spec/tasks tabs), and spec artifacts are resolved from a legacy `specs/active/` path that doesn't match the OpenSpec convention.

This means:

- The Dashboard and feature navigation are hidden from users
- OpenSpec artifacts (proposal.md, spec.md, design.md) are not reviewable in the UI
- Task progress tracking is disconnected from OpenSpec's `tasks.md` location
- The app can't serve the spec-first workflow where design review happens before implementation

## What Changes

1. **Flip `FLAGS.DEV_WORKFLOW`** to `true` — enables Dashboard, feature nav bar, Tasks tab
2. **Remove the Spec tab** — OpenSpec artifacts are naturally visible as new files in the Code tab's diff view, eliminating the need for a separate spec rendering pipeline
3. **Switch path resolution** from `specs/active/{featureId}/` to `openspec/changes/{featureId}/` for task loading and feature discovery
4. **Simplify nav** to two tabs: Tasks + Code
5. **Visual grouping** in the file sidebar — openspec/ files appear above implementation files

## Capabilities

### New

- Full dev workflow enabled by default (dashboard, feature nav, task board)
- OpenSpec artifacts (proposal, spec, design) visible and annotatable in Code tab
- Feature discovery reads from `openspec/changes/` directory
- Task progress parsed from `openspec/changes/{id}/tasks.md`

### Modified

- `FeatureNavBar` tabs reduced from [Spec, Tasks, Code] to [Tasks, Code]
- `FeatureInfo` metadata sourced from openspec paths instead of legacy paths
- Feature status derivation no longer depends on a separate spec session
- File sidebar naturally groups openspec/ files via folder tree view

## Alternatives Considered

1. **Sub-tabs within Spec tab** (Proposal | Spec | Design) — rejected because the existing code diff view already handles markdown files with full annotation support. Adding a parallel rendering pipeline is unnecessary complexity.

2. **Flatten all artifacts as top-level tabs** (Proposal | Spec | Design | Tasks | Code) — rejected as too many tabs, and some features won't have all artifacts.

3. **Dedicated spec viewer with TipTap** (current implementation) — being removed. The TipTap-based SpecReviewPage adds significant complexity for a capability the diff view already provides.

4. **Full-file rendering for openspec files** (no diff) — initially considered because edited specs would show as diffs. Rejected because at design review time, all openspec files are new additions (all-green diff), and during code review they're unchanged from the initial commit. The natural diff behavior is correct.

## Impact

- **Breaking**: Spec review sessions (`{featureId}-spec.json`) become unused; annotations on specs now live in the code review session
- **Migration**: Existing features with `specs/active/` paths won't be discovered unless they also have openspec artifacts. Archived features at `specs/archived/` remain accessible.
- **Removal**: `SpecReviewPage`, spec-related API routes (GET/PUT spec), and the TipTap annotation infrastructure for specs become dead code eligible for removal

## Linear Ticket

none
