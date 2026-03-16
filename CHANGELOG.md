# Changelog

## [Unreleased]

## [1.2.2] - 2026-03-16

- Add plugin cache version cleanup on SessionStart to remove old cached versions and save disk space

* Simplify active version detection by reading from plugin.json instead of installed_plugins.json

## 1.2.1 — 2026-03-16

- Version display next to app title in Dashboard and ReviewPage headers

* Rename commit-diff API parameter from `hash` to `commit` for consistency with UI
* Preserve original session `createdAt` timestamp across auto-saves

! Fix tilde path expansion in worktree resolution causing empty diffs in feature code view

## 1.2.0 — 2026-03-15

### UI

- Migrate to shadcn/ui component library (Button, Badge, Skeleton, Dialog, Command, Popover, Collapsible, ToggleGroup, Textarea, Alert)
- Upgrade Tailwind CSS v3 to v4 with CSS-first config and oklch theming
- Add keyboard shortcut help dialog with focus trapping (shadcn Dialog)
- Rewrite command palette with cmdk for improved fuzzy search and accessibility
- Replace FeatureNavBar dropdown with shadcn Popover

* Move copy-path icon next to file name in diff header
* Replace /Users/home paths with ~ in worktree path display
* Pin dark mode via class="dark" for consistent shadcn component styling
  ! Fix CommandItem name collision crashing command palette
  ! Fix tasks not rendering due to CollapsibleContent height animation
  ! Fix ComposeBox textarea text barely visible on dark theme
  ! Fix DialogHeader outside portal breaking ARIA structure
  ! Fix ToggleGroup type errors with Radix union props

### Server

- Support heading-format tasks.md with phase/task status markers ([x]/[ ]/[→])

* Replace hardcoded home paths with $HOME in release-prep command

### Docs

- Update README with dashboard, tasks, and review screenshots
- Add keyboard shortcuts and task tracking sections to README

## [1.1.0] - 2026-03-14

### UI/Dashboard

- Compact row list redesign with single-row FeatureNavBar
- Unified list view dashboard with status-coded rows
- Task status legend visualization
- Optional label toggle to PipelineDots component

* Tab navigation redesigned with bottom-border underline indicators
* Feature card styling simplified for improved visual hierarchy
* Task legend inlined; removed monospace from section labels
* UI theming migrated from Notion-dark to GitHub-dark tokens
* Diff and shared UI components updated with new theming tokens

! Critical issues from code review resolved

### Development Workflow

- Release-prep slash command added
- Type-aware ESLint hardening with floating promises detection
- Knip integration for dead code detection
- OpenSpec development workflow enhancements
- Review progress ring visualization (2026-03-11-review-progress-ring)

* Type-check added to pre-commit hook
* Server bundling and config updates

! Fixed pre-commit hook executability
! Fixed lint-staged exit code preservation
! Fixed diff stat memo deduplication with scroll persistence debouncing
! Fixed feature fetch error distinction (failed vs. empty)
! Resolved knip entry points and useFeaturesContext errors

### Documentation

- API route architecture clarified — routes live only in apps/server

### Build & Maintenance

- Knip dead code cleanup completed across codebase

* UI dist assets rebuilt with new theming
* Server and bundled dist updated

## 1.0.0 — 2026-03-09

Initial release.

- Browser-based code review UI with syntax-highlighted diffs
- Inline threaded comments on single or multi-line selections
- Thread resolution via `review-resolver` subagent
- Standalone Hono server with REST API + WebSocket, bundled via esbuild for zero-install
- Auto-detected sessions scoped per feature branch
- Feature dashboard, spec review, and task board views
- Session persistence to `.review/sessions/*.json`
- `/local-review:open` and `/local-review:resolve` slash commands
- Keyboard-driven code review navigation — arrow keys, j/k thread cycling, r/o resolve/reopen, Ctrl+K file search, ? help modal
- OpenSpec configuration and schema for spec-driven development workflow
