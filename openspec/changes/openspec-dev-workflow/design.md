# Design: Enable Dev Workflow & OpenSpec Artifact Review

## Context

The local-review app has a complete dev workflow behind a feature flag (`FLAGS.DEV_WORKFLOW = false`). Enabling it requires aligning the artifact path resolution with OpenSpec conventions and simplifying the navigation by removing the dedicated Spec tab.

## Goals / Non-Goals

### Goals

- Enable the full dev workflow (dashboard, feature nav, task board) by default
- Make all OpenSpec artifacts (proposal, spec, design) reviewable via the Code tab
- Switch artifact resolution to `openspec/changes/{featureId}/` convention
- Keep the change minimal — configuration and path changes only

### Non-Goals

- Building a dedicated spec/markdown viewer (the diff view handles this)
- Migrating existing `specs/active/` or `specs/archived/` data
- Adding `.openspec.yaml` metadata to the API (future enhancement)
- Removing dead code from SpecReviewPage (follow-up cleanup)

## Technical Design

### Components

#### 1. Feature Flag (`apps/ui/src/config/app.ts`)

```
FLAGS.DEV_WORKFLOW: false → true
```

This single change enables:

- Dashboard page at `/`
- FeatureNavBar with tab navigation
- Tasks and Code routes under `/features/:featureId/`
- Feature status badges and approve verdict

#### 2. Navigation Tabs (`apps/ui/src/components/FeatureNavBar.tsx`)

Remove "Spec" from the tabs array:

```
Before: [Spec, Tasks, Code]
After:  [Tasks, Code]
```

The spec thread count badge on the Spec tab is also removed.

#### 3. Routing (`apps/ui/src/App.tsx`)

Remove the SpecReviewPage route. Update `FeatureDefaultRedirect`:

- If feature has tasks → default to Tasks tab
- If feature has code changes → default to Code tab
- If feature has openspec artifacts only → default to Code tab (design review)

#### 4. Feature Discovery (`apps/server/src/routes/features.ts`)

Update path resolution for active worktrees:

```
Before:
  specMdPath  = {wt}/specs/active/{id}/spec.md
  tasksMdPath = {wt}/specs/active/{id}/tasks.md

After:
  specMdPath  = {wt}/openspec/changes/{id}/spec.md
  tasksMdPath = {wt}/openspec/changes/{id}/tasks.md
```

Also check for `proposal.md` and `design.md` to set `hasSpec = true` when any openspec artifact exists.

#### 5. Tasks Route (`apps/server/src/routes/tasks.ts`)

Update `tasks.md` path resolution:

```
Before: {wt}/specs/active/{id}/tasks.md
After:  {wt}/openspec/changes/{id}/tasks.md
```

**Parser update required**: The existing `parseTasksMarkdown()` expects `### Phase` headings and `T1: description` syntax. OpenSpec uses `## Phase` headings and `T-1 description` syntax. Update the parser regex:

```
Phase heading:  /^###\s+/ → /^##\s+/ (or accept both)
Task line:      /^\s*-\s+\[([^\]]*)\]\s+(T\d+):\s+(.+)$/
            →   /^\s*-\s+\[([^\]]*)\]\s+(T-?\d+):?\s+(.+)$/
```

Similarly update `parseTaskProgress()` in `features.ts`:

```
Current: /- \[[x→~ ]\] T\d+/gi
Updated: /- \[[x→~ ]\] T-?\d+/gi
```

#### 6. Status Default Tabs (`apps/ui/src/utils/featureStatus.ts`)

Update `defaultTab` for design-phase statuses:

```
Before: new → "spec", design → "spec", design_review → "spec"
After:  new → "code", design → "code", design_review → "code"
```

The type `defaultTab: "spec" | "code"` can be simplified to just `"code" | "tasks"`.

#### 7. Dashboard Quick Links (`apps/ui/src/components/dashboard/FeatureCard.tsx`)

Update the "Spec" quick action link to point to Code tab instead:

```
Before: <ActionLink to={`/features/${id}/spec`}>Spec</ActionLink>
After:  Remove or change to <ActionLink to={`/features/${id}/code`}>Review</ActionLink>
```

#### 8. FeatureNavBar defaultFallbackTab (`apps/ui/src/components/FeatureNavBar.tsx`)

Line 57 hardcodes `"spec"` as fallback when `hasSpec` is true:

```
Before: const defaultFallbackTab = currentFeature && !currentFeature.hasSpec ? "code" : "spec"
After:  const defaultFallbackTab = currentFeature && !currentFeature.hasSpec ? "code" : "code"
```

Simplify to always fall back to `"code"`.

#### 9. Fix archived tasks.md path bug (`apps/server/src/routes/tasks.ts`)

Pre-existing bug: archived fallback path doubles the featureId:

```
Before: specs/archived/{featureId}/{featureId}/tasks.md
After:  specs/archived/{featureId}/tasks.md
```

#### 10. Dead code cleanup for knip compliance

CLAUDE.md requires `pnpm knip` to pass before merge. Removing the Spec route will leave `SpecReviewPage` and its imports as dead code. Remove unused imports and exports from:

- `App.tsx` (SpecReviewPage import)
- `FeatureNavBar.tsx` (spec-related badge logic)
- Any orphaned spec-only hooks or components flagged by knip

#### 11. Feature Status Derivation (`apps/server/src/routes/features.ts`)

Update `deriveFeatureStatus()`:

```
Before:
  specSession + codeSession → status
  specSession verdict drives design/design_review

After:
  hasOpenspecArtifacts + codeSession → status
  If openspec exists but no code session → "design" (ready for review)
  If code session exists → "code" or "code_review" (unchanged)
```

### Data Flow

```
┌──────────────────────┐
│ Feature Worktree     │
│                      │
│ openspec/changes/    │
│   {id}/              │
│     proposal.md ─────┼──┐
│     spec.md ─────────┼──┤
│     design.md ───────┼──┤    git diff main...feature/{id}
│     tasks.md ────────┼──┼──────────────────────────────────▶ Code tab
│                      │  │                                     (all files)
│ src/                 │  │
│   foo.ts ────────────┼──┤
│   bar.ts ────────────┼──┘
│                      │
│ openspec/changes/    │    fs.readFile + parseTaskProgress()
│   {id}/tasks.md ─────┼──────────────────────────────────────▶ Tasks tab
│                      │                                        (progress)
└──────────────────────┘
```

### Error Handling

- **Missing openspec directory**: Feature shows with `hasSpec: false`, `hasTasks: false` — same as today for features without specs
- **Partial artifacts**: Feature is discoverable if any openspec file exists (proposal, spec, or design)
- **Legacy paths**: `specs/archived/` fallback remains for completed features. Active features at `specs/active/` won't be found unless they also have openspec artifacts — this is intentional as we're moving forward with openspec only.

## Risks & Trade-offs

1. **Spec review sessions become orphaned** — Existing `{featureId}-spec.json` sessions from previous spec reviews won't be loaded. Annotations made in those sessions are effectively lost. Acceptable since this is a development tool with no production data at stake.

2. **No migration for `specs/active/`** — Active features using the legacy path need manual migration or re-creation with openspec. Acceptable since there are currently no active features using the legacy path.

3. **All-green diff for spec files** — During design review, openspec files show as entirely new (green) in the diff view. This is actually desirable — it makes every line annotatable.

## Open Questions

None — design is straightforward.
