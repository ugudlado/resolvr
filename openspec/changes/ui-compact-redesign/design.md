# Design: UI Compact Redesign — Dashboard & FeatureNavBar

## Context

The dashboard currently renders a 2-column card grid (`FeatureCard`) and a 2-row `FeatureNavBar`. The mockup `ux-redesign-mockup.html` defines a compact, information-dense row list for the dashboard and a single-row navbar. All existing design tokens (Notion Dark) are compatible — this is a structural/layout change, not a design system change.

## Goals / Non-Goals

### Goals

- Single-column compact row list for dashboard with CSS grid alignment
- Flat feature list (no collapsible completed section)
- Status filter dropdown alongside sort control
- FeatureNavBar in one horizontal row
- Colored status dot (not badge) in feature switcher
- Linear progress bar for task progress in rows (matching mockup's `.progress-track`/`.progress-fill`)

### Non-Goals

- No new npm dependencies
- No API or data model changes
- No routing changes
- No Spec tab addition to navbar
- No changes to the review page, tasks page, or any other views

## Technical Design

### Components

#### `FeatureRow.tsx` (new)

```
apps/ui/src/components/dashboard/FeatureRow.tsx
```

Props: `{ feature: FeatureInfo, searchQuery?: string }`

Layout: `div` with CSS grid, `grid-template-columns: 2.5fr 1fr 1.5fr 1.2fr auto`, `border-l-[3px]` for status accent.

Grid cells:

1. **Title + Branch** (col 1): monospace feature ID with search highlight, git branch icon + branch name below
2. **Status Pill** (col 2): same pill style as mockup — uppercase 10px, `pill-review` / `pill-code` / `pill-complete` variants
3. **Metrics** (col 3): two stacked rows — `[thread icon] N Open Threads` (amber if >0, emerald checkmark if all resolved, else slate), `[file icon] N files`
4. **Progress Bar** (col 4): Linear progress bar (h-1, `bg-ink-ghost` track, `bg-accent-blue` fill, `bg-accent-emerald` when 100%) with `done/total Tasks` label below (10px, faint). Uses same markup as mockup's `.progress-track`/`.progress-fill`. When `total === 0`, hide the entire progress column.
5. **Time** (col 5): `relativeTime(feature.lastActivity)` — tabular-nums, faint

Hover: `hover:translate-x-1 hover:border-[var(--border-hover)]` (border brightens on hover)
Complete state: `opacity-60`

Status left border map (Tailwind arbitrary border-color):

```tsx
const ROW_ACCENT: Record<FeatureStatus, string> = {
  new: "border-l-slate-600",
  design: "border-l-purple-500",
  design_review: "border-l-amber-400",
  code: "border-l-blue-400",
  code_review: "border-l-amber-400",
  complete: "border-l-accent-emerald",
};
```

Click handler: ``onClick={() => navigate(`/features/${feature.id}`)``

Keyboard accessibility: `role="link"`, `tabIndex={0}`, Enter/Space activation, `focus-visible:ring-2 focus-visible:ring-accent-blue` styling (matching current `FeatureCard` behavior).

#### `SkeletonRow.tsx` (new, or modify `SkeletonCard.tsx`)

Match row grid layout with `animate-pulse` bars in each column. Replace `SkeletonCard` usage in `Dashboard.tsx`.

#### `Dashboard.tsx` (modified)

New state:

```tsx
const [statusFilter, setStatusFilter] = useState<FeatureStatus | "all">("all");
```

Removed state: `completedOpen` (no longer needed)
Removed helpers: `ChevronIcon`, `isCompleted` (dead code after removing collapsible section)

Filter logic in `useMemo`:

```tsx
const filtered = features
  .filter((f) => !q || f.id.includes(q) || f.branch.includes(q))
  .filter((f) => statusFilter === "all" || f.status === statusFilter);
```

Sort logic: Active features sorted by `sortKey` appear first; completed features sorted by `sortKey` appear after. This is a two-group sort: non-complete first, complete second, each group internally sorted.

`searchCount` reflects the combined filter result (both `searchQuery` and `statusFilter` applied before counting).

Render: Single `div.flex.flex-col.gap-2` with all features mapped to `FeatureRow`. No grid, no completed section. Completed features rendered inline with `opacity-60`.

Empty states:

- Zero features total → render `<EmptyState />` (unchanged)
- Non-empty features but zero after filtering → render "No features matching" message with current search/filter values

Controls layout:

```
[search input (flex-1)]  [sort dropdown]  [status filter dropdown]  [Refresh button]
```

Status filter options:

- All
- New
- Design
- Design Review
- Code
- Code Review
- Complete

#### `FeatureNavBar.tsx` (modified)

Collapse from two-row to one-row. Remove the `<div>` wrapping row 1 and `<nav>` wrapping row 2. Merge into a single `<header>` with one `<div className="flex items-center gap-2 px-4 py-2">`.

Order of elements (left → right):

1. `← Dashboard` link (unchanged)
2. `/` separator (unchanged)
3. Feature switcher button — add **status dot** before the feature name:
   ```tsx
   <span
     className={`h-2 w-2 rounded-full ${STATUS_DOT[currentFeature.status]}`}
     style={{ boxShadow: STATUS_DOT_GLOW[currentFeature.status] }}
   />
   ```
   Remove the full status badge that currently appears inside the switcher button.
4. Tab pills (Tasks + Code) — moved into the same row after the switcher, separated by a subtle `mx-2` spacer. **`FLAGS.DEV_WORKFLOW` guard must be preserved** — tabs only render when the flag is enabled.
5. `ml-auto` section: worktree path + copy button + header actions slot

The dropdown panel is unchanged — still appears below the switcher button.

Status dot color map:

```tsx
const STATUS_DOT: Record<FeatureStatus, string> = {
  new: "bg-slate-500",
  design: "bg-purple-500",
  design_review: "bg-amber-400",
  code: "bg-blue-400",
  code_review: "bg-amber-400",
  complete: "bg-emerald-400",
};
const STATUS_DOT_GLOW: Record<FeatureStatus, string> = {
  new: "none",
  design: "0 0 6px rgba(168,85,247,0.5)",
  design_review: "0 0 6px rgba(251,191,36,0.4)",
  code: "0 0 6px rgba(96,165,250,0.4)",
  code_review: "0 0 6px rgba(251,191,36,0.4)",
  complete: "0 0 6px rgba(52,211,153,0.4)",
};
```

### Data Flow

```
featureApi.getFeatures()
  → features[]
  → useMemo: filter by searchQuery + statusFilter → sort by sortKey
  → map to <FeatureRow />
```

No changes to WebSocket, API routes, or server-side logic.

### Error Handling

No changes to error handling. Dashboard's existing error banner and retry flow are preserved.

## Risks & Trade-offs

- **`FeatureCard.tsx` becomes unused**: Can delete it or keep it dormant. `knip` will flag it — delete is cleaner.
- **`SkeletonCard.tsx` becomes unused**: Same — replace with `SkeletonRow` and delete old file.
- **Linear progress bar for task progress**: `ThreadProgressRing` is not reused for tasks because its API (`resolved/open`) and semantics (thread-specific tooltip, aria labels) are wrong for task data. A simple `div`-based progress bar matches the mockup exactly and avoids regressing existing `ThreadProgressRing` usages.
- **Flat completed list vs collapsible**: Completed features with `opacity-60` still clutter the list if there are many. Acceptable for now; a "hide completed" toggle can be added later.

## Open Questions

None — all decisions were resolved in exploration with user input.
