# Proposal: Review Progress Ring

## Why

The local-review UI currently has no at-a-glance visualization of review thread resolution progress. Thread counts are scattered across different contexts in different formats — plain text on dashboard cards ("3 open"), an amber badge on the Spec tab in FeatureNavBar, and diff stats in the ReviewPage toolbar with no thread awareness at all.

Users doing code review need to quickly assess: "How far along is this review? How many threads are still open?" This is especially important during the resolve workflow where threads are being closed automatically.

## What Changes

Add a `ProgressRing` component — a segmented SVG donut chart showing resolved vs open review threads — and embed it in three UI contexts:

1. **ReviewPage toolbar**: 28px compact ring next to diff stats, with hover tooltip showing resolved/open breakdown
2. **FeatureNavBar Code tab**: Amber count badge matching the existing Spec tab pattern
3. **Dashboard FeatureCard**: 18px mini ring replacing the current "N open" text in the metrics row

Also expand the `/features` API to return `threadCounts: { open, resolved }` instead of just `openThreads: number`, so dashboard and navbar contexts have enough data for the ring.

## Capabilities

### New

- `ProgressRing` shared component (SVG-based, configurable size/thickness)
- Hover tooltip with per-status thread counts
- Emerald glow animation when all threads are resolved (100%)
- `threadCounts` field in `/features` API response

### Modified

- ReviewPage toolbar — adds ring after diff stats
- FeatureNavBar — adds amber badge to Code tab (matching Spec tab pattern)
- FeatureCard — replaces "N open" text with mini ring
- `countOpenThreads` server helper → `countThreads` returning both counts
- `FeatureInfo` type (server + client) — `openThreads: number` → `threadCounts: { open: number; resolved: number }`

## Alternatives Considered

**Chart.js / Recharts**: Overkill for a single donut chart. Both add 30-100KB to bundle. The SVG ring is ~80 lines of code using `stroke-dasharray` / `stroke-dashoffset` — the same technique proven in the interactive prototype at `docs/plans/review-progress-ring.html`.

**Three segments (resolved/open/critical)**: The initial prototype had a separate "critical" segment. Decided against it because thread severity is already visible on individual thread cards via analytics labels (from the thread-triage feature). The ring's purpose is progress overview, not severity triage.

**Separate API endpoint for thread counts**: Could add `GET /features/:id/thread-counts`. But the existing `/features` endpoint already iterates all threads in `countOpenThreads` — adding a resolved count is one extra condition in the loop. No separate endpoint needed.

## Impact

- **Breaking change**: `FeatureInfo.openThreads` → `FeatureInfo.threadCounts`. All consumers (FeatureCard, FeatureNavBar, useFeaturesContext) need updating.
- **Bundle size**: Negligible — pure SVG, no new dependencies.
- **Performance**: No extra API calls. Thread counting happens in the existing `/features` response path.

## Linear Ticket

Pending — will be created after spec approval.
