# Changelog

## [Unreleased]

## 2.0.6 — 2026-03-24

- Improved VS Code extension README with clearer Claude integration instructions
- Renamed VS Code extension ID to ugudlado.local-code-review and added marketplace README

## 2.0.5 — 2026-03-24

### Plugin

- Publish VS Code extension to VS Code Marketplace (ugudlado.local-review-vscode)

* Rename plugin ID to local-code-review (install: claude plugin install local-code-review@ugudlado)
* Rename VS Code extension display name to "Local Code Review"

### VS Code Extension

- Add repository and license fields to extension manifest

* Add VSCE_PAT guard and --packagePath flag to release process for safe marketplace publishing

## [2.0.4] - 2026-03-21

### Server

- Added health check endpoint with version detection for robust server health verification

### Plugin

- Enhanced session-start hook with version-aware health checks to prevent reusing stale processes from previous versions

* Simplified cache cleanup to use mtime-based version detection, removing dependency on installed_plugins.json

## [2.0.3] - 2026-03-21

### Plugin

! Fixed stale server process zombie issue - session-start hook now verifies server health and cleans up unhealthy processes occupying the port

## [2.0.2] - 2026-03-21

### Plugin

- Changed cleanup-cache to read active plugin version from ~/.claude/plugins/installed_plugins.json instead of local plugin.json, improving reliability when multiple versions are cached

## [2.0.1] - 2026-03-21

### VS Code Extension

- Improve comment handling — fix inline buttons to show Reopen for resolved threads, fix threads tree refresh after status changes
- Add context menu actions (Resolve/Reopen) to threads tree view items
- Replace file status string literals with DiffStatus enum for type safety

! Fix thread clicks on deleted files opening plain file instead of diff view
! Fix commentThread.isResolved when clause (doesn't exist) — use contextValue instead

### Plugin

- Simplify /resolve command — detect feature from branch, direct file I/O, remove --spec/--code flags

## [2.0.0] - 2026-03-21

### VS Code Extension

- Serverless architecture — eliminate server dependency, direct file I/O for sessions
- Auto-create session files on feature branch activation
- File-type icons and review progress indicators in sidebar
- Threads tree view grouped by status in SCM sidebar
- Status badges and contextual action buttons for thread states
- Won't Fix and Mark Outdated thread actions
- Thread collapse/expand with keyboard shortcuts
- Scroll to thread line when clicking in sidebar
- Clickable threads open diff view directly

* Rename SCM panels to "Local Review: Changed Files" / "Local Review: Threads"
* Move Changed Files and Threads views to Source Control sidebar
* Simplify to 2 view modes: flat + compact-tree toggle (removed tree mode)
* Address UX critique with filename labels and tinted file icons

! Force standard a/b diff prefixes to handle mnemonic prefix config
! Harden error handling — distinguish ENOENT, tighten git execution
! Wire file watcher suppression and fix mutation bug
! Handle missing anchor.path in threads tree view
! Replace timer-based cooldown with skip-count for reconciliation
! Remove duplicate status buttons from context menu
! Prevent reconciliation loop with cooldown after status change
! Migrate tsconfig from deprecated node10 moduleResolution
! Defensive URI path normalization

### UI

- Add thread collapse/expand with four-section navigation
- Expand thread status system with helpers and components
- Improve split-button visibility in dark theme

! Remove useEffect auto-collapse to prevent re-render loop

### Plugin

- Reorganize project-level commands and skills into .claude/ directory
- Update release-prep to include VS Code extension versioning and .vsix build

### Documentation

- Add VS Code extension screenshot to docs
- Update project structure documentation for VS Code extension

## [1.3.0] - 2026-03-19

### Server

- Multi-repo dashboard with workspace registry and SessionStart hook integration
- Repo middleware for context propagation across all API routes
- Real repo name resolution for worktree environments

* Refactored API routes to propagate repo context (context, features, sessions, spec, tasks)
* Updated open command with repo selection UI

! Fix repo name resolution for worktrees to prevent stale environments
! Fix dashboard labels to use API repoName instead of workspace name

### UI

- Dashboard design overhaul with multi-repo context
- Repo context hook for workspace-aware component behavior

* Recovered dashboard design from orphaned commits
* Updated FeatureNavBar and FeatureRow components for multi-repo support

### Documentation

- Updated CLAUDE.md and README for multi-repo dashboard

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
