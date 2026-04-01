# Tasks: shadcn/ui Migration + Tailwind v4 Upgrade

## [x] Phase 1: Foundation

### [x] T-1: Set up path aliases and shadcn utility

**Why**: shadcn components require `@/` import alias and the `cn()` utility function. This is the prerequisite for all other tasks.

**Files**:

- `apps/ui/vite.config.ts` -- add `resolve.alias` for `@/`
- `apps/ui/tsconfig.json` -- add `baseUrl` and `paths` for `@/*`
- `apps/ui/src/lib/utils.ts` -- create `cn()` utility (clsx + tailwind-merge)

**Verify**:

- `import { cn } from "@/lib/utils"` resolves in a test file
- `pnpm type-check` passes
- `pnpm -C apps/ui dev` starts without errors

---

### [x] T-2: Upgrade Tailwind CSS v3 to v4

**Why**: R7 requires migrating from Tailwind v3 (JS config + PostCSS) to Tailwind v4 (CSS-first config + Vite plugin). shadcn v3.x (latest) requires Tailwind v4. This must complete before any shadcn component work.

**Files**:

- `apps/ui/package.json` -- upgrade `tailwindcss` to ^4.x, add `@tailwindcss/vite`, remove `autoprefixer` and `postcss`
- `apps/ui/vite.config.ts` -- add `@tailwindcss/vite` plugin, remove any PostCSS references
- `apps/ui/src/index.css` -- replace `@tailwind base; @tailwind components; @tailwind utilities;` with `@import "tailwindcss";`, move `@layer base { :root { ... } }` variables to plain `:root { ... }` block (Tailwind v4 layer handling differs), convert `@layer utilities { ... }` custom animation classes to plain CSS or use `@utility` directive
- `apps/ui/tailwind.config.js` -- DELETE this file; migrate all custom theme values (colors, fonts) to `@theme inline { ... }` block in `index.css`
- `apps/ui/postcss.config.cjs` -- DELETE this file (Tailwind v4 uses Vite plugin, not PostCSS)

**Verify**:

- `CI=true pnpm install` succeeds
- `pnpm -C apps/ui dev` starts without errors
- All existing pages render with correct colors, fonts, and spacing (no visual regressions)
- Tailwind utility classes still work: `bg-base`, `text-ink`, `border-border`, `bg-canvas-raised`, `text-accent-emerald`, etc.
- Custom animation classes still work: `thread-enter`, `compose-enter`, `sidebar-item`, `stagger-fade-in`
- `@git-diff-view/react` CSS still renders correctly (third-party CSS interaction check)
- `pnpm type-check` passes
- `pnpm lint` passes

---

### [x] T-3: Install shadcn dependencies and create components.json

**Why**: Core dependencies (clsx, tailwind-merge, class-variance-authority) and `components.json` config are needed before any shadcn component can be added. Uses shadcn v3.x (latest) targeting Tailwind v4.

**Files**:

- `apps/ui/package.json` -- add clsx, tailwind-merge, class-variance-authority
- `apps/ui/components.json` -- create shadcn v3.x configuration (Tailwind v4 format, `tailwind.config` set to empty string, oklch colors, `iconLibrary: "lucide"`)

**Verify**:

- `CI=true pnpm install` succeeds
- `components.json` has correct paths matching project structure
- `npx shadcn@latest add button` runs successfully (smoke test)
- `pnpm type-check` passes

---

### [x] T-4: Add shadcn CSS variables to theme (oklch)

**Why**: R2 requires mapping existing CSS vars to shadcn's oklch-based theming system. All shadcn components reference these variables. They must be registered via `@theme inline` for Tailwind v4.

**Files**:

- `apps/ui/src/index.css` -- add shadcn CSS variables to `:root` block (oklch format: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar-*`, `--radius`), add `@theme inline` registration block for shadcn color variables

**Verify**:

- All existing pages render identically (no color changes)
- New CSS variables are defined and produce correct colors when inspected in browser devtools
- shadcn utility classes work: `bg-background`, `text-foreground`, `bg-primary`, `border-border`
- Existing custom utility classes still work: `bg-base`, `text-ink`, `bg-canvas-raised`
- `pnpm type-check` passes

---

## [x] Phase 2: Shared Components

### [x] T-5: Add shadcn Button component and migrate ComposeBox

**Why**: Button is the most foundational shadcn component. ComposeBox has two inline `<button>` elements (Cancel, Comment) that are prime candidates for Button replacement. This validates the shadcn setup end-to-end.

**Files**:

- `apps/ui/src/components/ui/button.tsx` -- add shadcn Button (via CLI or manual)
- `apps/ui/src/components/shared/ComposeBox.tsx` -- replace inline buttons with shadcn Button

**Verify**:

- ComposeBox renders identically on Code Review page
- Cancel and Comment buttons maintain existing hover/disabled states
- Cmd+Enter submit still works
- `pnpm type-check` passes

---

### [x] T-6: Add shadcn Badge and migrate SectionLabel + FeatureRow StatusPill

**Why**: Badge provides consistent badge styling. SectionLabel uses an inline badge span for counts, and FeatureRow's StatusPill is a badge pattern. Both are simple swaps.

**Files**:

- `apps/ui/src/components/ui/badge.tsx` -- add shadcn Badge
- `apps/ui/src/components/shared/SectionLabel.tsx` -- use Badge for count pill
- `apps/ui/src/components/dashboard/FeatureRow.tsx` -- use Badge for StatusPill

**Verify**:

- SectionLabel count badges render with correct open/resolved colors
- Dashboard FeatureRow status pills render correctly for all 6 statuses
- `pnpm type-check` passes

---

### [x] T-7: Add shadcn Skeleton and migrate SkeletonRow

**Why**: SkeletonRow uses a hand-rolled SkeletonPulse component. shadcn Skeleton provides the same pulse animation with proper accessibility attributes.

**Files**:

- `apps/ui/src/components/ui/skeleton.tsx` -- add shadcn Skeleton
- `apps/ui/src/components/dashboard/SkeletonRow.tsx` -- replace SkeletonPulse with Skeleton

**Verify**:

- Dashboard loading state shows skeleton rows with pulse animation
- Grid column layout matches FeatureRow
- `pnpm type-check` passes

---

### [x] T-8: Add shadcn Dialog and migrate ShortcutHelp

**Why**: ShortcutHelp is a modal dialog with backdrop, focus trapping is missing. shadcn Dialog provides proper accessibility (focus trap, ARIA attributes, Esc to close).

**Files**:

- `apps/ui/src/components/ui/dialog.tsx` -- add shadcn Dialog
- `apps/ui/src/components/shared/ShortcutHelp.tsx` -- rewrite using Dialog

**Verify**:

- Press `?` opens shortcut help modal
- Esc closes modal
- Focus is trapped within modal while open
- All shortcut rows display correctly
- `pnpm type-check` passes

---

## [x] Phase 3: Layout and Navigation

### [x] T-9: Add shadcn Command and migrate CommandPalette

**Why**: CommandPalette is ~180 lines of custom keyboard navigation, filtering, and group rendering. cmdk (via shadcn Command) handles all of this natively with superior accessibility and fuzzy matching.

**Files**:

- `apps/ui/src/components/ui/command.tsx` -- add shadcn Command (installs cmdk dependency)
- `apps/ui/src/components/shared/CommandPalette.tsx` -- rewrite using Command
- `apps/ui/package.json` -- cmdk added as dependency

**Verify**:

- Cmd+K opens command palette
- Typing filters items across all groups (Files, Threads, Actions)
- Arrow keys navigate, Enter selects, Esc closes
- Group headings display correctly
- Shortcut hints display in items
- `pnpm type-check` passes

---

### [x] T-10: Add shadcn Popover and migrate FeatureNavBar dropdown

**Why**: FeatureNavBar has a hand-built dropdown with click-outside detection (~30 lines of useEffect). shadcn Popover handles positioning, click-outside, and focus management.

**Files**:

- `apps/ui/src/components/ui/popover.tsx` -- add shadcn Popover
- `apps/ui/src/components/FeatureNavBar.tsx` -- replace dropdown with Popover

**Verify**:

- Feature switcher dropdown opens on click
- Search input focuses on open
- Feature list renders with status badges
- Click outside closes dropdown
- Switching features navigates correctly
- `pnpm type-check` passes

---

### [x] T-11: Validate keyboard shortcut integration with Radix overlays

**Why**: The `useKeyboardReview` hook registers global listeners for Escape, Cmd+K, j/k, r, o, and `?`. Radix Dialog (ShortcutHelp), Command (CommandPalette), and Popover (FeatureNavBar) all introduce their own focus traps and Escape handling. If these are not tested together, global shortcuts may fire inside overlays (e.g., pressing `j` in the Command input triggers "next thread") or Escape may not close the correct layer.

**Files**:

- `apps/ui/src/hooks/useKeyboardReview.ts` -- review for conflicts with Radix focus management
- `apps/ui/src/components/shared/CommandPalette.tsx` -- verify input does not leak keystrokes to global handler
- `apps/ui/src/components/shared/ShortcutHelp.tsx` -- verify Dialog captures Escape before global handler
- `apps/ui/src/components/FeatureNavBar.tsx` -- verify Popover captures Escape before global handler

**Verify**:

- With no overlay open: all global shortcuts work (Cmd+K, j/k, r, o, ?, Esc)
- With Command palette open: typing in the search input does NOT trigger j/k/r/o global shortcuts; Escape closes the palette (not handled by global); Enter selects an item
- With ShortcutHelp Dialog open: Escape closes the dialog (not handled by global); j/k/r/o do NOT trigger while dialog is open
- With FeatureNavBar Popover open: Escape closes the popover (not handled by global); typing in the search input does not trigger global shortcuts
- After closing any overlay: focus returns to the previously focused element; global shortcuts resume working
- Stacking: opening Command palette while Popover is open works correctly (Command takes priority)
- `pnpm type-check` passes

---

## [x] Phase 4: Dashboard and Error Handling

### [x] T-12: Migrate ErrorBoundary fallback to use shadcn Alert + Button

**Why**: ErrorBoundary's fallback UI has two inline buttons (Try Again, Refresh). Using shadcn Alert for the error message and Button for actions ensures consistent styling and accessibility.

**Files**:

- `apps/ui/src/components/ui/alert.tsx` -- add shadcn Alert
- `apps/ui/src/components/ErrorBoundary.tsx` -- use Alert for error display, Button for fallback actions

**Verify**:

- Error fallback displays correctly (trigger by throwing in a component during dev)
- Both buttons work: Try Again resets boundary, Refresh reloads page
- Alert and button styles match the dark theme
- `pnpm type-check` passes

---

## [x] Phase 5: Review and Tasks

### [x] T-13: Migrate ReviewVerdict buttons to shadcn Button

**Why**: ReviewVerdict has a request-changes toggle button plus action buttons (Retry, Re-resolve). There is no Approve button -- the component controls the request-changes path only. Using shadcn Button with variants ensures consistent styling across these controls.

**Files**:

- `apps/ui/src/components/shared/ReviewVerdict.tsx` -- use Button for request-changes toggle, retry, and re-resolve buttons

**Verify**:

- Request Changes button toggles correctly (active/inactive states with correct blue styling)
- "Ready to merge" hint still shows when verdict is approved (set externally)
- Resolve status indicator (spinner, progress bar, completion summary) still works
- Retry button appears on resolve failure and triggers retry
- Re-resolve button appears when idle with open threads and verdict is changes_requested
- `pnpm type-check` passes

---

### [x] T-14: Add shadcn Collapsible and migrate PhaseSection + TaskRow

**Why**: PhaseSection and TaskRow both manage expand/collapse state manually. shadcn Collapsible provides animated collapse with proper accessibility (aria-expanded).

**Files**:

- `apps/ui/src/components/ui/collapsible.tsx` -- add shadcn Collapsible
- `apps/ui/src/components/tasks/PhaseSection.tsx` -- use Collapsible for phase body
- `apps/ui/src/components/tasks/TaskRow.tsx` -- use Collapsible for details panel

**Verify**:

- Phase headers toggle collapse on click
- Chevron rotates on collapse/expand
- Task details panel expands/collapses on click
- In-progress tasks auto-expand on mount
- Collapse/expand animation works via CSS transition on `[data-state=open]` / `[data-state=closed]` attributes
- `pnpm type-check` passes

---

### [x] T-15: Add shadcn ToggleGroup and migrate OverviewTab filter pills

**Why**: OverviewTab has filter pill buttons (All, Open, Resolved, Outdated) that behave as a single-select toggle group. shadcn ToggleGroup provides this with proper ARIA.

**Files**:

- `apps/ui/src/components/ui/toggle.tsx` -- add shadcn Toggle
- `apps/ui/src/components/ui/toggle-group.tsx` -- add shadcn ToggleGroup
- `apps/ui/src/components/sidebar/OverviewTab.tsx` -- use ToggleGroup for filter pills

**Verify**:

- Filter pills render in Overview tab sidebar
- Clicking a filter updates the active state
- Only one filter is active at a time
- Thread list filters correctly
- `pnpm type-check` passes

---

## [x] Phase 6: Cleanup

### [x] T-16: Add shadcn Textarea and complete ComposeBox migration

**Why**: ComposeBox uses an inline `<textarea>` with custom auto-resize. shadcn Textarea provides consistent styling. The auto-resize logic stays in ComposeBox.

**Files**:

- `apps/ui/src/components/ui/textarea.tsx` -- add shadcn Textarea
- `apps/ui/src/components/shared/ComposeBox.tsx` -- use Textarea for input area

**Verify**:

- Textarea auto-resizes on input
- Placeholder text shows correctly
- Styling matches the dark theme
- `pnpm type-check` passes

---

### [x] T-17: Remove unused hand-rolled styles and verify all pages

**Why**: After migration, some CSS utility classes, inline styles, and the deleted config files may leave orphaned references. Clean up and do a final verification pass.

**Files**:

- `apps/ui/src/index.css` -- remove any orphaned animation/utility classes if now unused
- All migrated component files -- remove commented-out old code
- `apps/ui/package.json` -- verify `autoprefixer` and `postcss` are fully removed, update `format` script if it references deleted config files

**Verify**:

- Dashboard page: feature list, skeleton loading, empty state all render correctly
- Code Review page: diff view, file sidebar, thread widgets, compose box all work
- Tasks page: phase sections collapse/expand, task details show, progress bar works
- Command palette (Cmd+K) opens and functions
- Shortcut help (?) opens and functions
- `pnpm type-check` passes
- `pnpm lint` passes
- `pnpm -C apps/ui test:unit` passes
- `pnpm knip` shows no new dead exports from migration
- Measure bundle size delta with `pnpm -C apps/ui build` and compare output size -- expected ~20-25KB gzipped increase from Radix primitives

---

### [x] T-18: Update imports to use `@/` path alias consistently

**Why**: With the `@/` alias set up in T-1, migrated files should use `@/` imports for consistency with shadcn conventions. This is optional but improves codebase consistency.

**Files**:

- All migrated component files -- update relative imports to `@/` where it improves clarity (e.g., `@/components/ui/button` instead of `../../components/ui/button`)
- Only update files that were already modified in this migration

**Verify**:

- All imports resolve correctly
- `pnpm type-check` passes
- `pnpm -C apps/ui dev` starts without errors

---

## Dependency Graph

```
T-1 (aliases) ───┐
                  ├── T-2 (Tailwind v4 upgrade)
                  │        │
                  │        └── T-3 (shadcn deps + components.json)
                  │              │
                  │              └── T-4 (oklch CSS vars + @theme inline)
                  │                    │
                  │              ┌─────┼─────────────────┐
                  │              │     │                  │
                  │        T-5 (Button)  T-6 (Badge)  T-7 (Skeleton)  T-8 (Dialog)
                  │              │     │                  │
                  │              └─────┼─────────────────┘
                  │                    │
                  │              ┌─────┴─────┐
                  │              │           │
                  │        T-9 (Command)  T-10 (Popover)
                  │              │           │
                  │              └─────┬─────┘
                  │                    │
                  │        T-11 (Keyboard shortcut integration)
                  │                    │
                  │                 T-12 (ErrorBoundary)
                  │                    │
                  │              ┌─────┼──────────┐
                  │              │     │          │
                  │       T-13 (ReviewVerdict)  T-14 (Collapsible)  T-15 (ToggleGroup)
                  │              │     │          │
                  │              └─────┼──────────┘
                  │                    │
                  │                 T-16 (Textarea)
                  │                    │
                  │                 T-17 (Cleanup)
                  │                    │
                  │                 T-18 (Import consistency)
```

## [x] Phase Gate Criteria

| Phase                 | Tasks              | Gate                                                                                                                             |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: Foundation   | T-1, T-2, T-3, T-4 | Tailwind v4 working, shadcn deps installed, oklch vars defined, `pnpm dev` starts, all pages render correctly, type-check passes |
| Phase 2: Shared       | T-5, T-6, T-7, T-8 | All shared components render correctly, type-check passes                                                                        |
| Phase 3: Layout       | T-9, T-10, T-11    | Cmd+K palette works, feature switcher works, all global shortcuts work with overlays open/closed, type-check passes              |
| Phase 4: Dashboard    | T-12               | Error boundary works with Alert + Button, type-check passes                                                                      |
| Phase 5: Review/Tasks | T-13, T-14, T-15   | Review verdict works, task board works with Collapsible animation, type-check passes                                             |
| Phase 6: Cleanup      | T-16, T-17, T-18   | Full test suite passes, lint passes, knip clean, bundle size delta verified, all pages verified                                  |
