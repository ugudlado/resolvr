# Local Review Plugin — Claude Instructions

## Project Overview

**Project**: local-review
**Repository**: Claude Code plugin for local code review with browser UI

## Quick Start

```bash
pnpm install           # Install dependencies for all workspaces
pnpm -C apps/ui dev   # Start Vite dev server at http://localhost:37002
```

**Note**: All `pnpm` commands run from the repository root. Use `-C apps/ui` prefix when running app-specific commands.

## Project Structure

```
.claude-plugin/     — Plugin metadata
commands/           — Slash commands (open, resolve)
agents/             — Subagent definitions (review-resolver)
hooks/              — Session hooks (auto-start dev server)
scripts/            — Shell scripts (context extraction)
specs/              — Feature specifications (active and archived)
apps/ui/            — React review app (Vite + Tailwind + TypeScript)
  src/components/   — React components
    dashboard/      — Feature dashboard cards and pipeline views
    diff/           — Diff rendering (DiffTable, ThreadWidget, selection)
    review/         — Review panels (ActivityPanel, ComposeBox, ThreadCard)
    shared/         — Reusable UI (CommandPalette, Skeleton, ReviewVerdict)
    sidebar/        — File sidebar and overview
    spec/           — Spec viewer (AnnotatableParagraph, diagrams)
    tasks/          — Task board (PhaseCard, TaskBoard)
  src/config/       — App configuration
  src/hooks/        — Custom React hooks (7 hooks)
  src/pages/        — Page components (Dashboard, CodeReview, SpecReview, Tasks, Review)
  src/services/     — API clients (localReviewApi, featureApi)
  src/styles/       — CSS themes (terminal-luxe)
  src/types/        — TypeScript type definitions
  src/utils/        — Diff parsing, spec anchoring, task parsing
  eslint.config.js  — ESLint 9 flat config (TypeScript + React)
  dist/             — Built output (committed for zero-build install)
docs/plans/         — Design documents (local only, gitignored)
.review/sessions/   — Runtime session storage (gitignored)
```

## Commands

Run all commands from the repository root. App-specific commands use `pnpm -C apps/ui`:

```bash
# Development (run from repo root)
pnpm -C apps/ui dev           # Start Vite dev server at http://localhost:37002
pnpm -C apps/ui build         # Build UI for production

# Testing (Vitest, config: apps/ui/vitest.config.unit.ts)
pnpm -C apps/ui test:unit     # Run unit tests
pnpm -C apps/ui test:watch    # Run tests in watch mode
pnpm -C apps/ui test:coverage # Run tests with coverage report
pnpm -C apps/ui test:ui       # Open Vitest UI dashboard

# Code quality (run from repo root)
pnpm type-check    # TypeScript type checking (both app and node configs)
pnpm lint          # Lint all files (ESLint 9 flat config)
pnpm format        # Format all source files (Prettier + Tailwind plugin)
```

**Port Configuration**: Change default port 37002 by setting `VITE_PORT` env var:

```bash
VITE_PORT=3000 pnpm -C apps/ui dev
```

## Architecture

### UI (apps/ui)

- **Framework**: React 18 with Vite 5
- **Routing**: React Router with feature-based layout (FeatureLayout + FeatureNavBar)
- **State**: Zustand with Immer middleware
- **Styling**: Tailwind CSS
- **API**: Vite plugin middleware in `vite.config.ts` provides REST endpoints (review sessions, features, specs, tasks)
- **Real-time**: WebSocket push for session file changes (file watcher)

### Plugin

- **Commands**: Markdown-based slash commands for Claude Code
- **Agent**: `review-resolver` subagent processes individual review threads
- **Hooks**: `SessionStart` hook auto-starts the Vite dev server

## Testing

- **Framework**: Vitest with `@vitest/ui` dashboard
- **Config**: `apps/ui/vitest.config.unit.ts`
- **Coverage**: View HTML report with `pnpm -C apps/ui coverage:html`
- **Files**: Tests colocate with source files (`.test.ts` / `.test.tsx`)

## Environment

```bash
# Optional environment variables:
VITE_PORT=3000      # Change dev server port (default: 37002)

# No other env vars required for basic usage
```

## Code Quality

- **ESLint**: Config at `apps/ui/eslint.config.js` (ESLint 9 flat config)
- **Prettier**: Config at `.prettierrc` with Tailwind CSS plugin
- **Pre-commit**: Husky runs lint-staged (eslint + prettier on staged ts/tsx files)
- ESLint binary lives in `apps/ui/node_modules` — lint-staged uses `pnpm -C apps/ui exec eslint`

## Important Reminders

1. **Workspace commands**: Use `pnpm -C apps/ui` for app-specific commands; use bare `pnpm` for repo-root commands
2. **Package manager**: Use `pnpm` (not npm); dependencies locked via pnpm-lock.yaml
3. **API routes**: Defined in `apps/ui/vite.config.ts` as Vite plugin middleware (simulates backend during dev)
4. **Session files**: Live in `.review/sessions/` (gitignored); created when user saves review sessions
5. **Built dist**: Committed to git (`apps/ui/dist/`) for zero-build plugin installation
6. **Plugin layout**: Source files live at repo root (`.claude-plugin/`, `commands/`, `agents/`, `hooks/`, `scripts/`) — do not create copies in subdirectories
7. **Pre-commit hooks**: Husky runs lint-staged on staged files (ESLint + Prettier) before commit
