# Design: Review Progress Ring

## Context

The local-review app has three UI contexts that show thread resolution information — ReviewPage toolbar, FeatureNavBar tabs, and Dashboard cards. Each context has different data availability and space constraints. The design needs a flexible component that adapts to these contexts while maintaining visual consistency with the terminal-luxe theme.

Interactive prototypes exist:

- `docs/plans/review-progress-ring.html` — Full playground with controls
- `docs/plans/review-progress-ring-mockup.html` — Three embed contexts in situ

## Goals / Non-Goals

### Goals

- Single `ThreadProgressRing` component reusable across all three contexts
- Smooth animated transitions when thread counts change (resolve/reopen)
- Hover tooltip with breakdown — consistent pattern across ring sizes
- API expansion with zero extra filesystem reads

### Non-Goals

- Severity breakdown in the ring (handled by thread labels)
- Spec session thread counts (ring is for code review progress)
- Historical progress tracking or trend visualization
- Animated ring on initial page load (only on count changes)

## Technical Design

### Components

#### `ThreadProgressRing` (`apps/ui/src/components/shared/ThreadProgressRing.tsx`)

> **Naming**: Separate from the existing `ProgressRing` component (used by `TaskTimeline` for task completion %). Different purpose, different API.

```typescript
interface ThreadProgressRingProps {
  resolved: number;
  open: number;
  size?: number; // default: 28
  thickness?: number; // default: 3
  showCenter?: boolean; // default: false — percentage + label in center
  className?: string;
}
```

**Glow**: Automatically activates when `open === 0 && resolved > 0` (no prop needed). Always appropriate at 100%.

**Rendering approach**: SVG `<circle>` elements with:

- Background track: `stroke: var(--ink-ghost)`, `opacity: 0.35`
- Resolved segment: `stroke: var(--accent-emerald)`, `stroke-dasharray` proportional to resolved/total
- Open segment: `stroke: var(--accent-amber)`, offset by resolved segment length
- `stroke-linecap: round` for polished ends
- 2-degree gap between segments when both are present
- `transition` on `stroke-dasharray` and `stroke-dashoffset` for animation

**Center text** (when `showCenter` is true):

- Percentage in JetBrains Mono, bold
- Color: emerald at 100%, amber when open > 0
- "resolved" / "complete" label below in --ink-faint

**Empty state** (0 total):

- Ghost track only
- Em-dash center text, "no threads" label

#### `ThreadProgressRingTooltip` (internal to ThreadProgressRing)

Positioned absolutely below the ring wrapper. CSS hover trigger (no JS state).

```
┌─────────────────┐
│ THREAD PROGRESS  │
├─────────────────┤
│ ● Resolved   8  │
│ ● Open       3  │
├─────────────────┤
│   Total     11  │
└─────────────────┘
```

Styling: `--canvas-elevated` bg, `--border` border, `--shadow-lg` shadow.

### Embed Integrations

#### ReviewPage Toolbar (`ReviewPage.tsx:~869`)

After the existing diff stats div, add a `|` divider and the ring group:

```tsx
<div className="toolbar-divider" />
<div className="toolbar-ring-group">
  <ThreadProgressRing resolved={resolvedCount} open={openCount} size={28} thickness={3} />
  <span className="ring-open-label">{openCount > 0 ? `${openCount} open` : 'all clear'}</span>
  {/* Glow auto-activates at 100% — no prop needed */}
</div>
```

Thread counts computed from `threads` array in `useReviewSession`:

```typescript
const resolvedCount = useMemo(
  () =>
    threads.filter((t) => t.status === "resolved" || t.status === "approved")
      .length,
  [threads],
);
const openCount = useMemo(
  () => threads.filter((t) => t.status === "open").length,
  [threads],
);
```

#### FeatureNavBar Code Tab (`FeatureNavBar.tsx:~326`)

Add amber badge matching the Spec tab pattern. Uses `codeThreadCounts` (not combined):

```tsx
{
  tab.path === "code" &&
    currentFeature &&
    currentFeature.codeThreadCounts.open > 0 && (
      <span className="bg-accent-amber/15 text-accent-amber rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
        {currentFeature.codeThreadCounts.open}
      </span>
    );
}
```

Also update the existing Spec tab badge to use `specThreadCounts.open` (was `openThreads`):

```tsx
{
  tab.path === "spec" &&
    currentFeature &&
    currentFeature.specThreadCounts.open > 0 && (
      <span className="bg-accent-amber/15 text-accent-amber rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
        {currentFeature.specThreadCounts.open}
      </span>
    );
}
```

#### Dashboard FeatureCard (`FeatureCard.tsx:~174`)

Replace the `ThreadIcon + "N open"` with ring + text:

```tsx
<ThreadProgressRing
  resolved={feature.codeThreadCounts.resolved}
  open={feature.codeThreadCounts.open}
  size={18}
  thickness={2.5}
/>
<span>{feature.codeThreadCounts.open > 0 ? `${feature.codeThreadCounts.open} open` : 'all clear'}</span>
```

### Data Flow

#### Server-side: `countSessionThreads` helper

Replaces `countOpenThreads`. Operates on a **single session** so callers get per-session counts:

```typescript
function countSessionThreads(session: Session): {
  open: number;
  resolved: number;
} {
  if (!session) return { open: 0, resolved: 0 };
  const threads = session.threads;
  if (!Array.isArray(threads)) return { open: 0, resolved: 0 };
  let open = 0;
  let resolved = 0;
  for (const t of threads) {
    if (t && typeof t === "object" && "status" in t) {
      if (t.status === THREAD_STATUS.Open) open++;
      else if (
        t.status === THREAD_STATUS.Resolved ||
        t.status === THREAD_STATUS.Approved
      )
        resolved++;
    }
  }
  return { open, resolved };
}
```

Called at each feature response site:

```typescript
codeThreadCounts: countSessionThreads(codeSession),
specThreadCounts: countSessionThreads(specSession),
```

#### Type changes

**Server** (`apps/server/src/routes/features.ts`):

```diff
 export interface FeatureInfo {
-  openThreads: number;
+  codeThreadCounts: { open: number; resolved: number };
+  specThreadCounts: { open: number; resolved: number };
 }
```

**Client** (`apps/ui/src/services/featureApi.ts`):

```diff
 export type FeatureInfo = {
-  openThreads: number;
+  codeThreadCounts: { open: number; resolved: number };
+  specThreadCounts: { open: number; resolved: number };
 };
```

### Error Handling

- **No threads array**: `countThreads` returns `{ open: 0, resolved: 0 }` — same defensive check as current `countOpenThreads`
- **Ring with 0 total**: Shows empty state (ghost track, em-dash) — no division by zero
- **Negative/NaN counts**: Clamp to 0 in ring rendering math
- **API backward compatibility**: Not maintained — this is an internal API with a single consumer. Clean break preferred.

## Risks & Trade-offs

| Risk                                                | Mitigation                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Breaking `FeatureInfo` type change                  | All consumers are in this codebase — grep + fix. No external API consumers.                                          |
| Ring too small at 18px on dashboard                 | Prototype validated this works. At 18px the ring is recognizable as a progress indicator even without readable text. |
| Hover tooltip doesn't work on mobile                | Acceptable — this is a desktop-only developer tool.                                                                  |
| SVG ring math edge cases (0%, 100%, single segment) | Prototype covers all these states. Port the same math.                                                               |

## Open Questions

None — all design questions resolved during exploration.
