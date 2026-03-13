# Proposal: UI Compact Redesign — Dashboard & FeatureNavBar

## Why

The current dashboard uses a 2-column card grid that's visually busy and doesn't scale well as the number of features grows. Each card takes significant vertical space, and the two-row FeatureNavBar wastes vertical real estate on every feature page.

The user has identified a mockup (`ux-redesign-mockup.html`) that better matches the desired UX: a compact list view for the dashboard and a single-row nav for feature pages. This aligns with how developer tools like Linear and GitHub handle dense feature lists — prioritizing information density and scannability over visual decoration.

## What Changes

1. **Dashboard**: Replace the 2-column card grid with a single-column compact row list. Each row uses CSS grid columns for consistent alignment across all rows. Features are sorted by last activity by default and displayed flat (no collapsible "Completed" section). A status filter dropdown is added alongside the existing sort control.

2. **FeatureNavBar**: Collapse the two-row layout into a single row. All elements (back link, feature switcher, tabs, worktree path, header actions) fit in one horizontal strip with a subtle container style matching the mockup.

## Capabilities

### New

- Status filter dropdown on dashboard (filter list by status: All, In Progress, Code Review, Complete, etc.)
- Single-row FeatureNavBar with status dot (colored circle) replacing the full status badge in the feature switcher

### Modified

- Dashboard layout: 2-col card grid → 1-col row list with CSS grid columns (title+branch | status pill | metrics | progress ring | time)
- Row hover: `translateX(4px)` slide-right instead of `translateY(-1px)` float-up
- Row border accent: left 3px colored border per status (instead of top border)
- Completed features: flat in the same list instead of collapsible section
- FeatureNavBar: 2-row → 1-row, status dot instead of full status badge in switcher
- Progress visualization: task progress shown as `ThreadProgressRing` (reusing existing component) instead of progress bars

## Alternatives Considered

- **Keep cards, just make them denser**: Could reduce padding on existing FeatureCard. Rejected — the card structure itself (stacked sections, borders) doesn't compress well below a certain height without major restructuring.
- **Build a new FeatureRow component vs modify FeatureCard**: A new `FeatureRow` component is cleaner since the layout model is fundamentally different (grid vs flex column). FeatureCard can be kept for potential future use or removed if unused.
- **Recharts / D3 for progress visualization**: Overkill. The existing `ThreadProgressRing` SVG component handles the ring display without any library dependency.

## Impact

- `Dashboard.tsx`: Render logic changes from card grid to row list; filter state added
- `FeatureCard.tsx`: Replaced by new `FeatureRow.tsx` component (or renamed/rewritten)
- `SkeletonCard.tsx`: Needs a matching `SkeletonRow.tsx` for loading state
- `FeatureNavBar.tsx`: Layout restructured from two-row to one-row
- No API changes, no data model changes, no routing changes

## Linear Ticket

none
