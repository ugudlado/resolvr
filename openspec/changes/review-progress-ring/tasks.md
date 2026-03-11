# Tasks: Review Progress Ring

## Phase 1: API & Type Foundation

- [x] T-1 Replace `countOpenThreads` with `countSessionThreads` in `apps/server/src/routes/features.ts` — operates on a single session, returns `{ open, resolved }`
  - **Why**: F12 — API must return per-session counts for ring and badge rendering
  - **Files**: `apps/server/src/routes/features.ts`
  - **Done when**: `countSessionThreads(session)` returns `{ open: number; resolved: number }`, uses `THREAD_STATUS` constants (not string literals)

- [x] T-2 Update `FeatureInfo` interface: `openThreads: number` → `codeThreadCounts` + `specThreadCounts` (depends: T-1)
  - **Why**: F13 — Per-session type change on server
  - **Files**: `apps/server/src/routes/features.ts`
  - **Done when**: `FeatureInfo` has `codeThreadCounts: { open, resolved }` and `specThreadCounts: { open, resolved }`, all feature response objects (worktree, branch, archived) call `countSessionThreads` separately for each session

- [x] T-3 Update client `FeatureInfo` type and all consumers (depends: T-2)
  - **Why**: F13 — Client type must match server
  - **Files**: `apps/ui/src/services/featureApi.ts`, `apps/ui/src/components/dashboard/FeatureCard.tsx`, `apps/ui/src/components/FeatureNavBar.tsx`, `apps/ui/src/hooks/useFeaturesContext.ts` (verify passthrough)
  - **Done when**: Client `FeatureInfo` uses `codeThreadCounts` + `specThreadCounts`, `FeatureCard` uses `codeThreadCounts.open` for display, `FeatureNavBar` Spec tab badge uses `specThreadCounts.open` (was `openThreads`), `pnpm type-check` passes

- [x] T-4 Rebuild server bundle (depends: T-2)
  - **Why**: NF5 — Server dist must reflect source changes
  - **Files**: `apps/server/dist/`
  - **Done when**: `pnpm -C apps/server build` succeeds, `pnpm type-check` passes

- [~] T-5 Review checkpoint (phase gate)

## Phase 2: ThreadProgressRing Component

- [ ] T-6 Create `ThreadProgressRing` component with SVG ring rendering (depends: T-5)
  - **Why**: F1, F2, F5, F6 — Core ring rendering with segments, empty state, animations
  - **Files**: `apps/ui/src/components/shared/ThreadProgressRing.tsx`
  - **Done when**: Component renders resolved/open segments with correct proportions, stroke-dasharray math matches prototype, empty state shows ghost track, transitions animate on prop changes. Existing `ProgressRing.tsx` is untouched.

- [ ] T-7 Add center text (percentage + label) to ThreadProgressRing (depends: T-6)
  - **Why**: F3, F4 — Center display with adaptive color and label
  - **Files**: `apps/ui/src/components/shared/ThreadProgressRing.tsx`
  - **Done when**: `showCenter` prop renders percentage with emerald/amber color, "resolved"/"complete" label, em-dash for empty state

- [ ] T-8 Add auto-glow animation to ThreadProgressRing (depends: T-6)
  - **Why**: F7 — Visual celebration at 100%
  - **Files**: `apps/ui/src/components/shared/ThreadProgressRing.tsx`
  - **Done when**: Emerald pulse keyframe activates automatically when `open === 0 && resolved > 0` — no prop needed

- [ ] T-9 Add hover tooltip to ThreadProgressRing (depends: T-6)
  - **Why**: F8 — Per-status breakdown on hover
  - **Files**: `apps/ui/src/components/shared/ThreadProgressRing.tsx`
  - **Done when**: CSS-triggered tooltip shows resolved/open rows with colored dots, counts, total. Styled with --canvas-elevated, --border, --shadow-lg.

- [ ] T-10 Review checkpoint (phase gate)

## Phase 3: Embed Integrations

- [ ] T-11 Embed 28px ring in ReviewPage toolbar (depends: T-10)
  - **Why**: F9 — Primary embed context
  - **Files**: `apps/ui/src/pages/ReviewPage.tsx`
  - **Done when**: Ring appears after diff stats with divider, shows computed resolved/open from useReviewSession threads using `THREAD_STATUS` constants, "N open" / "all clear" text beside it

- [ ] T-12 Add amber badge to FeatureNavBar Code tab + fix Spec tab badge (depends: T-5)
  - **Why**: F10, F13 — Code tab badge using `codeThreadCounts.open`, Spec tab badge using `specThreadCounts.open`
  - **Files**: `apps/ui/src/components/FeatureNavBar.tsx`
  - **Done when**: Code tab shows amber badge with `codeThreadCounts.open` when > 0, Spec tab badge updated from `openThreads` to `specThreadCounts.open`, both match existing styling

- [ ] T-13 Replace FeatureCard thread text with 18px ring (depends: T-10)
  - **Why**: F11 — Dashboard ring embed
  - **Files**: `apps/ui/src/components/dashboard/FeatureCard.tsx`
  - **Done when**: Metrics row shows 18px ThreadProgressRing + "N open" / "all clear" / "0 threads" text with hover tooltip, replaces ThreadIcon + text, uses `codeThreadCounts`

- [ ] T-14 Review checkpoint (phase gate)

## Phase 4: Polish & Build

- [ ] T-15 Rebuild UI dist (depends: T-14)
  - **Why**: NF1 — UI dist must be committed for zero-build install
  - **Files**: `apps/ui/dist/`
  - **Done when**: `pnpm -C apps/ui build` succeeds, dist updated

- [ ] T-16 Run lint, type-check, and format (depends: T-15)
  - **Why**: Code quality gate
  - **Done when**: `pnpm lint && pnpm type-check && pnpm format --check` all pass

- [ ] T-17 Review checkpoint (phase gate)
