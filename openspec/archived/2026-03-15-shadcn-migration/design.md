# Design: shadcn/ui Migration + Tailwind v4 Upgrade

## Approach: Incremental Wrap-and-Replace

Migrate one component group at a time, validating each phase before proceeding. The Tailwind v4 upgrade happens first (Phase 1) since shadcn v3.x depends on it. This minimizes risk compared to a big-bang rewrite and allows easy rollback of individual phases.

## 1. Tailwind v4 Upgrade Strategy

### What Changes

| Aspect            | Tailwind v3 (current)                 | Tailwind v4 (target)                       |
| ----------------- | ------------------------------------- | ------------------------------------------ |
| Config            | `tailwind.config.js` (JavaScript)     | `@theme` blocks in CSS                     |
| Imports           | `@tailwind base/components/utilities` | `@import "tailwindcss"`                    |
| Build             | PostCSS plugin (`postcss.config.cjs`) | Vite plugin (`@tailwindcss/vite`)          |
| Content detection | Explicit `content: [...]` array       | Automatic                                  |
| Autoprefixer      | Separate `autoprefixer` dep           | Built-in                                   |
| Custom colors     | `theme.extend.colors` in JS           | `@theme inline { --color-*: ... }` in CSS  |
| Color format      | hex / any                             | oklch preferred (for shadcn compatibility) |

### Files to Remove

- `apps/ui/tailwind.config.js` -- replaced by CSS `@theme` blocks
- `apps/ui/postcss.config.cjs` -- replaced by `@tailwindcss/vite`

### Dependencies to Change

| Action  | Package                     | Notes                                     |
| ------- | --------------------------- | ----------------------------------------- |
| Upgrade | `tailwindcss` 3.4.17 -> 4.x | Major version bump                        |
| Add     | `@tailwindcss/vite`         | Vite plugin replaces PostCSS integration  |
| Remove  | `autoprefixer`              | Built into Tailwind v4                    |
| Remove  | `postcss`                   | No longer needed (Vite plugin handles it) |

### vite.config.ts Update

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // ...
});
```

### CSS Migration: index.css

Replace the top-level directives:

```css
/* BEFORE (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* AFTER (v4) */
@import "tailwindcss";
```

### Theme Migration: tailwind.config.js -> @theme inline

The current `tailwind.config.js` defines custom colors and fonts. These move into CSS `@theme` blocks.

Current JS config:

```js
colors: {
  base: "var(--bg-base)",
  surface: "var(--bg-surface)",
  elevated: "var(--bg-elevated)",
  overlay: "var(--bg-overlay)",
  canvas: { DEFAULT: "#1a1a1f", raised: "#222228", elevated: "#2a2a31", overlay: "#32323a" },
  ink: { DEFAULT: "#e8e6e3", muted: "#9a9898", faint: "#5e5d5c", ghost: "#3d3d42" },
  accent: { emerald: "#34d399", "emerald-dim": "#065f46", amber: "#fbbf24", "amber-dim": "#78350f", blue: "#60a5fa", "blue-dim": "#1e3a5f", rose: "#fb7185", "rose-dim": "#4c1d2e" },
  border: { DEFAULT: "#2e2e35", subtle: "#262629" },
},
fontFamily: {
  sans: ["DM Sans", "system-ui", "sans-serif"],
  serif: ["Newsreader", "Georgia", "serif"],
  mono: ["JetBrains Mono", "monospace"],
}
```

Becomes CSS `@theme` block:

```css
@theme inline {
  /* Custom colors — registered as Tailwind utilities (bg-base, text-ink, etc.) */
  --color-base: var(--bg-base);
  --color-surface: var(--bg-surface);
  --color-elevated: var(--bg-elevated);
  --color-overlay: var(--bg-overlay);

  --color-canvas: #1a1a1f;
  --color-canvas-raised: #222228;
  --color-canvas-elevated: #2a2a31;
  --color-canvas-overlay: #32323a;

  --color-ink: #e8e6e3;
  --color-ink-muted: #9a9898;
  --color-ink-faint: #5e5d5c;
  --color-ink-ghost: #3d3d42;

  --color-accent-emerald: #34d399;
  --color-accent-emerald-dim: #065f46;
  --color-accent-amber: #fbbf24;
  --color-accent-amber-dim: #78350f;
  --color-accent-blue: #60a5fa;
  --color-accent-blue-dim: #1e3a5f;
  --color-accent-rose: #fb7185;
  --color-accent-rose-dim: #4c1d2e;

  --color-border: #2e2e35;
  --color-border-subtle: #262629;

  /* Fonts */
  --font-sans: "DM Sans", "system-ui", "sans-serif";
  --font-serif: "Newsreader", "Georgia", "serif";
  --font-mono: "JetBrains Mono", "monospace";
}
```

**Key Tailwind v4 difference**: In v4, `@theme inline` makes CSS variables available as Tailwind utilities but does not generate `--color-*` custom properties on `:root`. The `inline` keyword means "use these values inline without emitting them as custom properties." Since we already define the raw CSS variables (`--bg-base`, etc.) separately in `:root`, this avoids duplication.

### Tailwind v4 Class Compatibility

Most Tailwind v3 classes work unchanged in v4. Known breaking changes to audit:

- `bg-opacity-*` -> `bg-<color>/<opacity>` (already using the slash syntax in most places)
- `ring-offset-*` -> may need adjustment
- `decoration-*` utilities -> mostly unchanged
- `shadow-*` -> unchanged
- `space-x/y-reverse` -> removed (not used in this project)

[ASSUMPTION] The codebase does not use removed v3 utilities. A build-and-test cycle will catch any breakages.

## 2. shadcn Initialization Strategy

### Path Alias Setup

shadcn requires a `@/` import alias. Currently the project has no path aliases.

**vite.config.ts** -- add resolve alias (combined with Tailwind v4 plugin):

```ts
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ...
});
```

**tsconfig.json** -- add paths:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### components.json

shadcn v3.x (latest, targeting Tailwind v4) config format:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Note: `tailwind.config` is empty string since Tailwind v4 uses CSS-first config (no JS config file).

**Style choice: new-york** -- uses smaller, more compact components that fit the terminal-luxe aesthetic better than the default style.

### Utility Function

Create `apps/ui/src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**New dependencies**: `clsx`, `tailwind-merge`, `class-variance-authority`, `cmdk` (for Command), plus Radix primitives installed per-component by shadcn CLI.

## 3. Theme Mapping (oklch)

### Current Variables -> shadcn Variables

shadcn v3.x uses oklch color values. The CSS variables store full oklch values, and Tailwind v4 applies them natively via `@theme inline`.

Map from the project's hex values to oklch:

| shadcn Variable               | Current Source     | Hex     | oklch                  |
| ----------------------------- | ------------------ | ------- | ---------------------- |
| `--background`                | `--bg-base`        | #0d1117 | `oklch(0.16 0.02 250)` |
| `--foreground`                | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--card`                      | `--bg-surface`     | #161b22 | `oklch(0.20 0.02 250)` |
| `--card-foreground`           | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--popover`                   | `--bg-surface`     | #161b22 | `oklch(0.20 0.02 250)` |
| `--popover-foreground`        | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--primary`                   | `--accent-blue`    | #60a5fa | `oklch(0.72 0.14 245)` |
| `--primary-foreground`        | white              | #ffffff | `oklch(1.0 0 0)`       |
| `--secondary`                 | `--bg-elevated`    | #21262d | `oklch(0.25 0.02 250)` |
| `--secondary-foreground`      | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--muted`                     | `--bg-elevated`    | #21262d | `oklch(0.25 0.02 250)` |
| `--muted-foreground`          | `--text-secondary` | #8b949e | `oklch(0.65 0.02 245)` |
| `--accent`                    | `--bg-elevated`    | #21262d | `oklch(0.25 0.02 250)` |
| `--accent-foreground`         | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--destructive`               | `--color-danger`   | #f85149 | `oklch(0.63 0.22 25)`  |
| `--border`                    | `--border-default` | #30363d | `oklch(0.30 0.01 250)` |
| `--input`                     | `--border-default` | #30363d | `oklch(0.30 0.01 250)` |
| `--ring`                      | `--accent-blue`    | #1f6feb | `oklch(0.55 0.18 250)` |
| `--radius`                    | n/a                | n/a     | `0.5rem`               |
| `--sidebar-background`        | `--bg-surface`     | #161b22 | `oklch(0.20 0.02 250)` |
| `--sidebar-foreground`        | `--text-secondary` | #8b949e | `oklch(0.65 0.02 245)` |
| `--sidebar-accent`            | `--bg-elevated`    | #21262d | `oklch(0.25 0.02 250)` |
| `--sidebar-accent-foreground` | `--text-primary`   | #e6edf3 | `oklch(0.94 0.01 250)` |
| `--sidebar-border`            | `--border-default` | #30363d | `oklch(0.30 0.01 250)` |
| `--sidebar-ring`              | `--accent-blue`    | #1f6feb | `oklch(0.55 0.18 250)` |

Note: oklch values are approximate. Exact conversion should be computed during implementation using a tool like `oklch.com` or CSS `oklch()` function to verify perceptual accuracy against the original hex values.

### Implementation Approach

Add shadcn variables to the `:root` block in `index.css`, then register them with `@theme inline`. Keep all existing hex-based variables intact -- they continue to be referenced by components not yet migrated and by domain-specific components that will never use shadcn tokens.

```css
@import "tailwindcss";

:root {
  /* Existing design tokens (unchanged, hex) */
  --bg-base: #0d1117;
  --bg-surface: #161b22;
  /* ... all existing variables stay ... */

  /* shadcn theme variables (oklch, additive) */
  --background: oklch(0.16 0.02 250);
  --foreground: oklch(0.94 0.01 250);
  --card: oklch(0.2 0.02 250);
  --card-foreground: oklch(0.94 0.01 250);
  --primary: oklch(0.72 0.14 245);
  --primary-foreground: oklch(1 0 0);
  /* ... */
  --radius: 0.5rem;
}

@theme inline {
  /* Register shadcn variables as Tailwind utilities */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Register project's custom colors as Tailwind utilities */
  --color-base: var(--bg-base);
  --color-surface: var(--bg-surface);
  --color-elevated: var(--bg-elevated);
  /* ... same as tailwind.config.js migration above ... */

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Known Conflict Resolution: `border` Token

The existing Tailwind config defines `colors.border` with `DEFAULT` and `subtle` variants. In Tailwind v4, shadcn also registers `--color-border`. Resolution:

- shadcn's `--color-border` takes precedence and maps to the same dark border color (`--border-default` / #30363d)
- The existing `--color-border-subtle` becomes `--color-border-subtle: #262629` in `@theme inline`
- The raw CSS variables `--border-default` and `--border-muted` remain in `:root` unchanged
- Components using `border-border` get the shadcn variable; components using `border-[var(--border-default)]` are unaffected

## 4. Component Migration Plan

### Classification: All 26 Components

#### `replace` -- Swap with shadcn component

| Component      | shadcn Replacement     | Notes                                                                                                                                                                                  |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CommandPalette | `Command` (wraps cmdk) | Full replacement. cmdk provides superior fuzzy matching, accessibility, and keyboard nav. Current implementation is ~180 lines of custom keyboard handling that cmdk handles natively. |
| ShortcutHelp   | `Dialog`               | Replace modal backdrop + positioning with Dialog. Keep shortcut data and layout.                                                                                                       |
| SkeletonRow    | `Skeleton`             | Replace SkeletonPulse spans with `<Skeleton className="h-3.5 w-3/5" />`.                                                                                                               |

#### `wrap` -- Use shadcn primitive internally, keep custom API

| Component     | shadcn Primitives Used      | Notes                                                                                                                                                                                                                                                      |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ComposeBox    | `Button`, `Textarea`        | Replace inline `<button>` and `<textarea>` with styled shadcn components. Keep ComposeBox as the public API.                                                                                                                                               |
| ReviewVerdict | `Button`                    | Replace request-changes toggle, retry, and re-resolve buttons with shadcn Button variants. Keep ReviewVerdict's complex resolve-status state logic. Note: there is no Approve button -- the component only has request-changes path and action buttons.    |
| SectionLabel  | `Badge`                     | Replace inline badge span with shadcn Badge. Keep SectionLabel as wrapper.                                                                                                                                                                                 |
| FeatureNavBar | `Popover` or `DropdownMenu` | Replace hand-built dropdown (click-outside handler, positioning) with shadcn Popover. Keep all nav logic.                                                                                                                                                  |
| PhaseSection  | `Collapsible`               | Replace manual collapse state with Collapsible. Keep phase rendering logic. Note: Collapsible does not include built-in animation -- requires explicit CSS transitions on `[data-state=open]`/`[data-state=closed]` attributes for smooth expand/collapse. |
| TaskRow       | `Collapsible`               | Replace manual expand/collapse with Collapsible for details panel. Keep all task rendering. Same CSS transition requirement as PhaseSection.                                                                                                               |
| OverviewTab   | `ToggleGroup`               | Replace filter pill buttons with ToggleGroup. Keep thread filtering logic.                                                                                                                                                                                 |
| ErrorBoundary | `Button`, `Alert`           | Replace fallback UI buttons with shadcn Button. Optionally use Alert for error display.                                                                                                                                                                    |
| FeatureRow    | `Badge`                     | Use Badge for StatusPill. Keep grid layout and all other rendering.                                                                                                                                                                                        |

#### `keep` -- No shadcn equivalent, stays as-is

| Component                 | Reason                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| DiffViewWrapper           | Thin wrapper around @git-diff-view/react                                  |
| DiffSelectionPopover      | Custom selection detection logic, not a generic popover                   |
| SelectionComposePortal    | React portal for compose box positioning                                  |
| ThreadWidget              | Domain-specific thread rendering within diff                              |
| LineRangeSelector         | Custom line range interaction                                             |
| DiffInlineThread          | Inline thread display within diff rows                                    |
| DiffThreadNav             | Thread navigation UI                                                      |
| FileSidebar               | @headless-tree integration, not replaceable                               |
| OverviewTab (thread list) | The thread list rendering stays custom; only filter pills use ToggleGroup |
| ProgressRing              | Custom SVG ring chart                                                     |
| ThreadProgressRing        | Custom SVG ring chart variant                                             |
| DepChain                  | Custom dependency chain visualization                                     |
| TaskTimeline              | Custom progress header                                                    |
| FeatureLayout             | Simple layout wrapper (Outlet + NavBar)                                   |
| EmptyState                | Too simple to warrant shadcn (just centered text + icon)                  |
| KeyboardHint              | Tiny fade-after-N-visits badge, no shadcn parallel                        |

## 5. Font Handling

Current setup uses `@fontsource/geist-sans` and `@fontsource/geist-mono` (imported in `index.css`) but the Tailwind config actually defines different font families:

- `sans`: DM Sans
- `serif`: Newsreader
- `mono`: JetBrains Mono

This is a pre-existing inconsistency -- the Geist font imports exist alongside the DM Sans / JetBrains Mono Tailwind config. The migration preserves whatever fonts are currently rendering by migrating the existing Tailwind font config to `@theme inline` as `--font-sans`, `--font-serif`, `--font-mono`. The `@fontsource` imports in `index.css` stay as `@import` statements. In Tailwind v4, CSS `@import` works natively (no PostCSS plugin needed).

shadcn defaults to Geist fonts, which are already installed. The `@theme` font config takes precedence over shadcn defaults.

Font standardization (resolving the DM Sans vs Geist inconsistency) is out of scope for this migration.

## 6. Risk Assessment

### Low Risk

- **Skeleton replacement**: Pure visual component, no interactivity. Direct swap.
- **Badge usage**: Adding Badge to SectionLabel and FeatureRow is additive.
- **Button replacement**: shadcn Button is a thin wrapper; easy to style-match.

### Medium Risk

- **Tailwind v4 upgrade**: Some utility classes may have changed behavior. The `@layer` directive behavior differs in v4 (user-defined layers are now ordered after Tailwind layers by default). The existing `@layer base` and `@layer utilities` blocks in `index.css` need testing.
- **CommandPalette -> Command**: The current implementation has custom group ordering (Files, Threads, Actions). cmdk supports groups natively but the API differs. Need to verify group rendering order is preserved. Additionally, cmdk uses a different filtering algorithm (ranked fuzzy matching) than the current simple `includes()` substring filter. We will need to either pass a custom `filter` function to `<Command>` to preserve substring matching, or accept cmdk's default scoring if it produces acceptable results.
- **FeatureNavBar dropdown -> Popover**: The current dropdown has search input, feature list with status badges, and keyboard navigation. Popover provides the shell; content stays custom.
- **CSS variable conflicts**: The `border` naming collision needs careful resolution (documented above).

### Higher Risk

- **@layer behavior in Tailwind v4**: Tailwind v4 treats CSS layers differently. The existing `@layer base { :root { ... } }` block may need restructuring. User-defined `@layer utilities` blocks with custom animations need validation -- they should still work but ordering may differ.
- **Third-party CSS interaction**: `@git-diff-view/react` brings its own CSS. Need to verify it doesn't conflict with Tailwind v4's reset layer.
- **Global keyboard shortcuts vs Radix focus management**: The `useKeyboardReview` hook registers global listeners for Escape, Cmd+K, j/k, r, o, and `?`. Radix Dialog, Command, and Popover all manage their own focus traps and Escape handling. When a Radix overlay is open, it must capture Escape before the global handler fires. Typing in the Command input must not trigger single-key shortcuts (j/k/r/o). Focus must return correctly to the previously focused element when overlays close. This requires a dedicated integration test pass after the overlay components are migrated.

### Mitigation

- **Phase gates**: The Tailwind v4 upgrade is a separate task (T-2) completed before any shadcn work. If v4 causes issues, they are isolated.
- **Visual regression check**: Manual comparison of each page before/after each phase.
- **Type checking**: `pnpm type-check` after each component swap catches API mismatches.
- **Keep old CSS variables**: Never remove existing hex variables. shadcn oklch variables are additive.

## 7. Dependencies: Full Change Summary

### Add (production)

| Package                        | Purpose                                      | Estimated Size (gzipped) |
| ------------------------------ | -------------------------------------------- | ------------------------ |
| `clsx`                         | Class merging utility                        | ~0.5KB                   |
| `tailwind-merge`               | Tailwind-aware class dedup                   | ~3KB                     |
| `class-variance-authority`     | Variant-based styling (cva)                  | ~1KB                     |
| `cmdk`                         | Command palette primitive                    | ~4KB                     |
| `@radix-ui/react-dialog`       | Dialog primitive                             | ~5KB                     |
| `@radix-ui/react-popover`      | Popover primitive                            | ~5KB                     |
| `@radix-ui/react-collapsible`  | Collapsible primitive                        | ~2KB                     |
| `@radix-ui/react-toggle-group` | Toggle group primitive                       | ~3KB                     |
| `@radix-ui/react-slot`         | Slot primitive (used by Button)              | ~0.5KB                   |
| `lucide-react`                 | Icon library (optional, for shadcn defaults) | tree-shakeable           |

### Add (dev)

| Package             | Purpose                 |
| ------------------- | ----------------------- |
| `@tailwindcss/vite` | Tailwind v4 Vite plugin |

### Upgrade (dev)

| Package       | From    | To            |
| ------------- | ------- | ------------- |
| `tailwindcss` | ^3.4.17 | ^4.x (latest) |

### Remove (dev)

| Package        | Reason                                  |
| -------------- | --------------------------------------- |
| `autoprefixer` | Built into Tailwind v4                  |
| `postcss`      | No longer needed with @tailwindcss/vite |

### Files Removed

| File                         | Reason                          |
| ---------------------------- | ------------------------------- |
| `apps/ui/tailwind.config.js` | Replaced by CSS `@theme` blocks |
| `apps/ui/postcss.config.cjs` | Replaced by `@tailwindcss/vite` |

**Total estimated bundle addition**: ~20-25KB gzipped for Radix + shadcn utilities. Tailwind v4 itself may produce a slightly smaller CSS output due to improved tree-shaking.

## 8. File Structure for shadcn Components

shadcn components will live at `apps/ui/src/components/ui/`:

```
apps/ui/src/
  components/
    ui/              <-- NEW: shadcn components (auto-generated)
      button.tsx
      badge.tsx
      skeleton.tsx
      command.tsx
      dialog.tsx
      collapsible.tsx
      popover.tsx
      toggle-group.tsx
      toggle.tsx
      alert.tsx
      textarea.tsx
    shared/          <-- Existing: project-specific shared components
    dashboard/       <-- Existing
    diff/            <-- Existing
    sidebar/         <-- Existing
    tasks/           <-- Existing
  lib/
    utils.ts         <-- NEW: cn() utility
```
