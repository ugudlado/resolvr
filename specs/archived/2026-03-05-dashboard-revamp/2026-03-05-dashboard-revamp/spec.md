# 2026-03-05-dashboard-revamp: Feature Dashboard Revamp

## Overview

Revamp the feature dashboard UI to transform the current bare-bones 2-column grid into an information-rich, polished dashboard. Enhanced cards will show task progress, review thread counts, timestamps, and compact pipeline dots. New states for empty, loading, search filtering, and errors replace the current generic handling.

## Development Mode

**Mode**: Non-TDD

## Requirements

### Must Have

- [ ] Enhanced FeatureCard with: feature title, status badge, branch, relative timestamp, task progress bar with count (e.g., "42/49"), open thread count, files changed count, compact pipeline dots with stage label
- [ ] Task progress data: parse `tasks.md` server-side to return `{ done, total }` per feature
- [ ] Open thread count: count threads with status "open" from session files per feature
- [ ] Relative timestamps: derive from session file mtime or git worktree activity
- [ ] Sort dropdown: sort features by Last Activity (default), Status, or Name
- [ ] Empty state: centered message with "No features yet" and `/specify <description>` command hint
- [ ] Loading skeleton: card-shaped skeleton placeholders with shimmer animation
- [ ] Search result count: show "N of M features" or "N features" in the search input
- [ ] Search match highlighting: highlight matched text in card titles
- [ ] Error banner: show specific error message with retry button
- [ ] Completed cards dimmed: 65% opacity for completed features section
- [ ] Hover effect: subtle card lift with colored top accent line matching feature status

### Nice to Have

- [ ] "No results" state when search matches nothing
- [ ] Keyboard navigation between cards (arrow keys)
- [ ] Status-colored pipeline dots (not just blue — use status color for current dot ring)

## Architecture

### Approach: Enhanced Cards with Rich Metadata

Keep the existing 2-column grid layout but transform each card into an information-dense tile. This preserves familiarity while solving all pain points.

**Why this approach over alternatives:**

- Kanban board rejected: too much horizontal scrolling, features don't move manually between stages
- Table view rejected: less visual appeal, harder to scan than cards for <10 features
- Summary stats bar rejected: redundant for solo developer with few features

### Data Flow

```
GET /local-api/features (enhanced response)
  ├── For each worktree:
  │   ├── Existing: id, branch, status, hasSpec, hasTasks
  │   ├── NEW: taskProgress: { done: number, total: number }
  │   │   └── Parsed from tasks.md: count [x] (done) vs total checkboxes
  │   ├── NEW: openThreads: number
  │   │   └── Count from spec-session + code-session threads where status === "open"
  │   ├── NEW: lastActivity: string (ISO timestamp)
  │   │   └── Most recent mtime of: spec.md, tasks.md, spec-session.json, code-session.json
  │   └── NEW: filesChanged: number
  │       └── Count from code-session diff file list (or 0 if no session)
  └── Returns sorted by lastActivity desc (default)
```

### Components

- **FeatureCard** (enhanced): Header row (title + timestamp), meta row (badge + branch), task progress bar, metrics row (threads + files + pipeline dots), action links
- **PipelineDots**: Replaces PipelineProgress — 6 compact dots with ring on current, stage label
- **SkeletonCard**: Loading placeholder matching card shape with shimmer animation
- **EmptyState**: Centered illustration + message + command hint
- **Dashboard** (enhanced): Sort state, search count display, skeleton loading, empty state routing

### Files to Create/Modify

**Modify:**

- `apps/ui/src/components/dashboard/FeatureCard.tsx` — Complete rewrite with enhanced layout
- `apps/ui/src/components/dashboard/PipelineProgress.tsx` — Replace with compact PipelineDots
- `apps/ui/src/pages/Dashboard.tsx` — Add sort, skeleton loading, empty state, search count
- `apps/ui/src/services/featureApi.ts` — Extend `FeatureInfo` type with new fields
- `apps/ui/src/types/sessions.ts` — Add `FeatureInfo` extended fields
- `apps/ui/vite.config.ts` — Enhance `/features` endpoint to return task progress, thread counts, timestamps, file counts

**Create:**

- `apps/ui/src/components/dashboard/SkeletonCard.tsx` — Loading skeleton component
- `apps/ui/src/components/dashboard/EmptyState.tsx` — Empty state component
- `apps/ui/src/components/dashboard/PipelineDots.tsx` — Compact pipeline indicator
- `apps/ui/src/utils/timeFormat.ts` — Relative timestamp formatting ("2d ago", "just now")

### Library References

No new libraries needed. Uses existing:

- React Router (navigation)
- Tailwind CSS (styling)
- Vite plugin middleware (API)

### Design Mockup

See `/private/tmp/claude-501/dashboard-mockup.html` for the full interactive mockup showing all 5 states.

## Alternatives Considered

### Kanban Board

- **Pros**: Visual pipeline flow, drag-and-drop between stages
- **Cons**: Horizontal scrolling, features don't manually move between stages (status is derived), wastes space with empty columns
- **Why rejected**: Over-engineered for a solo dev tool where status is automatically derived from session files

### Switchable Views (Cards + Table)

- **Pros**: Power users get dense table, visual users get cards
- **Cons**: Two layouts to maintain and test, unnecessary complexity
- **Why rejected**: For <10 features, a well-designed card view provides sufficient density without a separate table

### Summary Stats Bar

- **Pros**: At-a-glance aggregate metrics ("4 Active, 12 Open Threads, 2 In Review")
- **Cons**: Extra visual weight, redundant when you can see all cards on screen
- **Why rejected**: Solo developer rarely has more than 5-6 active features, making aggregates unnecessary

## Acceptance Criteria

- [ ] Dashboard shows task completion progress (X/Y) with visual bar for each feature
- [ ] Dashboard shows open thread count (highlighted in yellow when > 0)
- [ ] Dashboard shows relative timestamps for last activity
- [ ] Features can be sorted by last activity, status, or name
- [ ] Empty state shows onboarding message with `/specify` command when no features exist
- [ ] Loading state shows skeleton card placeholders instead of a spinner
- [ ] Search shows "N of M features" count and highlights matched text
- [ ] Error state shows specific error message with retry button
- [ ] Completed features are visually dimmed at 65% opacity
- [ ] Cards show colored top accent line on hover matching their status color
- [ ] All existing functionality (navigation, quick action links, real-time updates) still works

## Open Questions

None — design approved via interactive mockup review.
