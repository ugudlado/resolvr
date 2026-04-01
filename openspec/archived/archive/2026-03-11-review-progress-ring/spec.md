---
mode: non-tdd
feature-id: 2026-03-11-review-progress-ring
linear-ticket: pending
---

# Specification: Review Progress Ring

## Overview

Add a `ThreadProgressRing` SVG donut chart component that visualizes review thread resolution progress (resolved vs open). Embed it in three UI contexts — ReviewPage toolbar, FeatureNavBar Code tab, and Dashboard FeatureCard — and expand the `/features` API to provide per-session thread counts for all contexts.

> **Note**: An existing `ProgressRing` component at the same path is used by `TaskTimeline` for task completion percentage. This feature creates a separate `ThreadProgressRing` to avoid collision.

## Requirements

### Functional

- [ ] F1: `ThreadProgressRing` component renders a segmented SVG donut with two segments: resolved (emerald) and open (amber)
- [ ] F2: Ring accepts `resolved`, `open`, `size`, `thickness`, `showCenter`, and `className` props
- [ ] F3: Ring shows center percentage text (`resolved / total * 100`) with adaptive color — emerald at 100%, amber when open > 0
- [ ] F4: Ring shows "resolved" label below percentage, or "complete" when 100%
- [ ] F5: Empty state (0 threads) shows ghost track with em-dash and "no threads" label
- [ ] F6: Segments animate with `cubic-bezier(0.4, 0, 0.2, 1)` easing on count changes
- [ ] F7: Automatic emerald glow pulse when all threads resolved (activates when `open === 0 && resolved > 0`)
- [ ] F8: Hover tooltip shows per-status breakdown with colored dots, counts, and total
- [ ] F9: ReviewPage toolbar embeds 28px ring after diff stats, with "N open" text and hover tooltip
- [ ] F10: FeatureNavBar Code tab shows amber count badge when open code threads > 0 (matching Spec tab pattern)
- [ ] F11: Dashboard FeatureCard metrics row shows 18px ring with "N open" / "all clear" text and hover tooltip
- [ ] F12: `/features` API returns per-session thread counts: `codeThreadCounts: { open, resolved }` and `specThreadCounts: { open, resolved }`
- [ ] F13: `FeatureInfo` type updated on both server and client; existing Spec tab badge updated to use `specThreadCounts.open`

### Non-Functional

- [ ] NF1: No new dependencies — pure SVG + CSS custom properties
- [ ] NF2: Ring renders correctly at all sizes from 16px to 160px
- [ ] NF3: Uses existing design tokens from `index.css` (--accent-emerald, --accent-amber, --ink-ghost, etc.)
- [ ] NF4: Tooltip uses existing styling patterns (canvas-elevated bg, border, shadow-lg)
- [ ] NF5: API change adds no extra filesystem reads — counting happens in the existing thread iteration loop

## Architecture

### Component: `ThreadProgressRing`

Location: `apps/ui/src/components/shared/ThreadProgressRing.tsx`

Pure presentational component. Takes resolved/open counts as props, renders SVG circles using `stroke-dasharray` / `stroke-dashoffset` technique. Separate from the existing `ProgressRing` (used by `TaskTimeline` for task completion percentage).

### Component: `ThreadProgressRingTooltip`

Part of `ThreadProgressRing.tsx`. Rendered as a positioned div triggered by hover on the ring wrapper. Shows resolved/open counts with colored dots.

### Server: `countSessionThreads` helper

Location: `apps/server/src/routes/features.ts`

Replaces `countOpenThreads`. Counts per single session (not aggregated):

- `open`: `status === "open"`
- `resolved`: `status === "resolved" || status === "approved"`

Called separately for code and spec sessions.

### Data Flow

```
Server: countSessionThreads(codeSession) → FeatureInfo.codeThreadCounts
         countSessionThreads(specSession) → FeatureInfo.specThreadCounts
  ↓
Client: featureApi.getFeatures() → useFeaturesContext
  ↓
├── Dashboard: FeatureCard reads codeThreadCounts for ring
├── FeatureNavBar Code tab: reads codeThreadCounts.open for badge
├── FeatureNavBar Spec tab: reads specThreadCounts.open for badge (was openThreads)
└── ReviewPage: reads full ReviewThread[] from useReviewSession
    (computes resolved/open locally, doesn't need API counts)
```

## Acceptance Criteria

- [ ] AC1: Given a review with 5 resolved and 3 open threads, when the ReviewPage toolbar renders, then a 28px ring shows ~62% with emerald/amber segments and "3 open" text
- [ ] AC2: Given all threads resolved, when the ring renders, then it shows "100%" in emerald, "complete" label, and glow pulse animation
- [ ] AC3: Given 0 threads, when the ring renders, then it shows a ghost track with em-dash and "no threads"
- [ ] AC4: Given open threads exist, when hovering the toolbar ring, then a tooltip appears with resolved/open counts and colored dots
- [ ] AC5: Given a feature with 4 open code threads and 2 open spec threads, when FeatureNavBar renders, then the Code tab shows amber "4" badge and the Spec tab shows amber "2" badge (scoped per session)
- [ ] AC6: Given a feature with 0 open code threads, when FeatureNavBar renders, then the Code tab shows no badge
- [ ] AC7: Given the dashboard loads, when FeatureCard renders, then the metrics row shows an 18px ring based on `codeThreadCounts` with "N open" or "all clear" text
- [ ] AC8: Given the `/features` API is called, when features are returned, then each has `codeThreadCounts: { open, resolved }` and `specThreadCounts: { open, resolved }`

## Decisions

| Decision                                                | Rationale                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Two segments (resolved/open), not three                 | Severity is already visible via thread labels from the thread-triage feature. Ring shows progress, not triage.                       |
| No separate critical segment color                      | Labels on individual threads already provide severity info. Avoids conflating status and severity dimensions.                        |
| Expand `/features` API                                  | `countOpenThreads` already iterates threads — adding resolved count is trivial. Avoids separate API call for dashboard ring.         |
| Per-session counts (not aggregated)                     | Code tab badge must show code-only threads, Spec tab must show spec-only. Aggregated count was semantically wrong for both.          |
| `openThreads` → `codeThreadCounts` + `specThreadCounts` | Breaking rename preferred over additive fields. Clean separation by session type.                                                    |
| Auto-glow at 100% (no prop)                             | The glow is always appropriate at 100% — making it opt-in risks forgetting to pass the prop in embed contexts.                       |
| `ThreadProgressRing` name                               | Existing `ProgressRing` is used by `TaskTimeline` for task %. Different purpose, different API. Separate component avoids collision. |
| Non-TDD mode                                            | Small UI feature with well-defined behavior. Interactive prototypes at `docs/plans/` validate the design visually.                   |
| No new dependencies                                     | SVG ring is ~80 lines. Chart libraries add 30-100KB for one donut.                                                                   |

## Diagrams

See `diagrams/` directory:

- `architecture.mmd` — Component embedding and data flow
