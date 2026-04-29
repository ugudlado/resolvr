# Specification: shadcn/ui Migration + Tailwind v4 Upgrade

## Motivation

The local-review UI currently uses 26 hand-rolled React components with inline Tailwind classes and CSS variable styling. While functional, this approach has several drawbacks:

1. **Inconsistent component APIs** -- each component defines its own prop patterns for common UI primitives (buttons, badges, modals, popovers). There is no shared Button or Badge component; instead, each file inlines its own `<button className="...">` with ad-hoc styling.

2. **Accessibility gaps** -- the hand-built CommandPalette and ShortcutHelp modal lack proper ARIA attributes (dialog role, focus trapping, screen reader announcements). The FeatureNavBar dropdown has no `aria-expanded` or `aria-haspopup`. These patterns are solved by Radix UI primitives that shadcn wraps.

3. **Maintenance overhead** -- when the design system needs a change (e.g., button hover states, badge sizes), the same pattern must be updated across many files independently. A shared component library reduces this to one change.

4. **Community ecosystem** -- shadcn/ui provides a widely-adopted, copy-paste component library built on Radix primitives. It integrates with Tailwind CSS and uses CSS variables for theming, which aligns with the project's existing approach.

5. **Tailwind v3 is approaching end of life** -- Tailwind v4 is the current major release with CSS-first configuration, automatic content detection, and native CSS `@theme` blocks. Upgrading now alongside the shadcn migration avoids doing two separate configuration overhauls. shadcn v3.x (latest) is designed for Tailwind v4.

## Requirements

### R1: Initialize shadcn with latest (v3.x) configuration for Tailwind v4

Set up `components.json`, path aliases (`@/` mapping to `apps/ui/src`), and the shadcn utility function (`cn`). Use the latest shadcn which targets Tailwind v4 and oklch colors. Run `npx shadcn@latest init -t vite` for proper Vite integration.

### R2: Map existing CSS variables to shadcn's theming system using oklch

shadcn v3.x expects CSS variables in oklch format, registered via `@theme inline` blocks. Map the project's existing hex-based CSS variables to oklch equivalents while preserving all current colors. The mapping must be additive -- existing `--bg-base`, `--text-primary`, etc. continue to work alongside shadcn variables.

### R3: Incrementally replace hand-rolled components with shadcn equivalents

Replace components that map directly to shadcn primitives. This includes:

- **CommandPalette** -> shadcn Command (built on cmdk)
- **ShortcutHelp** -> shadcn Dialog
- **SkeletonRow** -> shadcn Skeleton
- **SectionLabel badge** -> shadcn Badge
- **ComposeBox buttons** -> shadcn Button
- **FeatureNavBar dropdown** -> shadcn DropdownMenu or Popover
- **OverviewTab filter buttons** -> shadcn Toggle / ToggleGroup
- **ErrorBoundary fallback** -> shadcn Alert + Button

### R4: Preserve all existing functionality

This is a refactor, not a feature change. Every page must render identically (within minor visual tolerance for improved accessibility). All keyboard shortcuts, navigation, and data flow remain unchanged.

### R5: Keep custom components that have no shadcn equivalent

The following components are domain-specific and have no meaningful shadcn mapping:

- **DiffViewWrapper** -- wraps @git-diff-view/react
- **ThreadWidget**, **DiffInlineThread**, **DiffThreadNav** -- diff threading UI
- **DiffSelectionPopover** -- text selection detection
- **SelectionComposePortal** -- portal for compose within diff
- **LineRangeSelector** -- diff line range selection
- **FileSidebar** -- headless-tree integration
- **ProgressRing**, **ThreadProgressRing** -- SVG ring charts
- **DepChain** -- dependency chain visualization
- **TaskTimeline** -- task progress header
- **FeatureRow** -- dashboard grid row (too custom for Card)

### R6: Maintain the terminal-luxe dark-only aesthetic

The project uses a carefully designed dark theme with specific backgrounds (#0d1117 base), text colors, accent colors (emerald, amber, blue, rose), and semantic colors. The migration must preserve a perceptually matching palette -- oklch values will be computed precisely during implementation and verified via screenshot comparison against the current hex-based rendering. No light mode support required.

### R7: Upgrade Tailwind CSS v3 to v4 with CSS-first configuration

Migrate the build pipeline from Tailwind v3 (JS config + PostCSS plugin) to Tailwind v4 (CSS-first `@theme` blocks + `@tailwindcss/vite` plugin):

- Replace `tailwindcss` v3.4.17 with `tailwindcss@latest` (v4.x)
- Install `@tailwindcss/vite` plugin and add it to `vite.config.ts`
- Remove `postcss.config.cjs` and `autoprefixer` dependency (Tailwind v4 handles autoprefixing natively)
- Remove `tailwind.config.js` -- migrate all custom theme values to CSS `@theme` blocks in `index.css`
- Replace `@tailwind base/components/utilities` directives with `@import "tailwindcss"`
- Register existing custom CSS variables as Tailwind utilities via `@theme inline { --color-*: ... }`
- Content detection is automatic in v4 -- the explicit `content: [...]` config is no longer needed

## Scope Boundaries

### In Scope

| Component                   | Migration Strategy                                                     |
| --------------------------- | ---------------------------------------------------------------------- |
| CommandPalette              | Replace with shadcn Command                                            |
| ShortcutHelp                | Replace with shadcn Dialog + Kbd styling                               |
| SkeletonRow / SkeletonPulse | Replace with shadcn Skeleton                                           |
| SectionLabel                | Wrap: use shadcn Badge for count pill                                  |
| ComposeBox                  | Wrap: use shadcn Button + Textarea                                     |
| ReviewVerdict               | Wrap: use shadcn Button for request-changes, retry, re-resolve buttons |
| ErrorBoundary fallback      | Replace with shadcn Alert + Button                                     |
| FeatureNavBar dropdown      | Wrap: use shadcn Popover or DropdownMenu                               |
| OverviewTab filter pills    | Wrap: use shadcn ToggleGroup                                           |
| StatusPill (in FeatureRow)  | Use shadcn Badge                                                       |
| PhaseSection collapse       | Wrap: use shadcn Collapsible                                           |
| TaskRow expand              | Wrap: use shadcn Collapsible                                           |
| EmptyState                  | Keep as-is (too simple for shadcn)                                     |
| Tailwind v3 -> v4           | Full upgrade: config, imports, plugins, theme format                   |

### Out of Scope

| Item                         | Reason                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Light mode / theme switching | Not needed for this project                                                                                       |
| New features or pages        | Pure refactor                                                                                                     |
| @git-diff-view integration   | Third-party component, no shadcn parallel                                                                         |
| @headless-tree integration   | FileSidebar tree is already using headless approach                                                               |
| Zustand store changes        | No state management changes                                                                                       |
| Server/API changes           | UI-only migration                                                                                                 |
| Font standardization         | Pre-existing inconsistency between @fontsource imports and Tailwind font config; not introduced by this migration |

## Acceptance Criteria

1. `components.json` exists with correct Tailwind v4 configuration and path aliases
2. All shadcn CSS variables are defined in `index.css` using oklch format via `@theme inline`
3. `@/` path alias works in imports (vite.config.ts + tsconfig.json updated)
4. At least the following shadcn components are installed and used: Button, Badge, Skeleton, Command, Dialog, Collapsible
5. All existing pages render correctly with no visual regressions
6. All keyboard shortcuts continue to work (Cmd+K, j/k, r, o, ?, Esc, etc.) -- verified with and without Radix overlays open, including Escape priority and focus return
7. Tailwind v4 is installed and working via `@tailwindcss/vite` plugin
8. `tailwind.config.js` is removed -- all theme config lives in CSS `@theme` blocks
9. `postcss.config.cjs` and `autoprefixer` are removed
10. `pnpm type-check` passes
11. `pnpm lint` passes
12. `pnpm -C apps/ui test:unit` passes
13. No increase in bundle size beyond the added Radix primitives (estimated ~15-25KB gzipped)

## Non-Goals

- No light mode or theme switching
- No new UI features
- No changes to the server, API, or plugin infrastructure
- No redesign of existing components -- visual output should match current
