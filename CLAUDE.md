# Local Review Plugin — Claude Instructions

## Project Overview

**Project**: local-review
**Repository**: Claude Code plugin for local code review with browser UI

## Project Structure

```
.claude-plugin/     — Plugin metadata
commands/           — Slash commands (open, resolve, reply)
agents/             — Subagent definitions (review-resolver)
hooks/              — Session hooks (auto-start dev server)
scripts/            — Shell scripts (context extraction)
apps/ui/            — React review app (Vite + Tailwind + TypeScript)
  src/components/   — React components (diff views, review panels, sidebar)
  src/hooks/        — Custom React hooks (useReviewSession, useDiffNavigation)
  src/pages/        — Page components (ReviewPage)
  src/services/     — API clients (localReviewApi)
  src/utils/        — Diff parsing and utilities
  eslint.config.js  — ESLint 9 flat config (TypeScript + React)
  dist/             — Built output (committed for zero-build install)
docs/plans/         — Design documents (local only, gitignored)
.review/sessions/   — Runtime session storage (gitignored)
```

## Commands

```bash
pnpm dev          # Start Vite dev server at http://localhost:3000
pnpm build        # Build UI for production
pnpm test:unit    # Run unit tests
pnpm lint         # Lint all files
pnpm format       # Format all source files with Prettier
```

## Architecture

### UI (apps/ui)

- **Framework**: React 18 with Vite 5
- **State**: Zustand with Immer middleware
- **Styling**: Tailwind CSS
- **API**: Vite plugin middleware in `vite.config.ts` provides REST endpoints
- **Real-time**: WebSocket push for session file changes (file watcher)

### Plugin

- **Commands**: Markdown-based slash commands for Claude Code
- **Agent**: `review-resolver` subagent processes individual review threads
- **Hooks**: `SessionStart` hook auto-starts the Vite dev server

## Environment

```bash
# No environment variables required for basic usage
# The Vite dev server runs on port 3000 by default
```

## Code Quality

- **ESLint**: Config at `apps/ui/eslint.config.js` (ESLint 9 flat config)
- **Prettier**: Config at `.prettierrc` with Tailwind CSS plugin
- **Pre-commit**: Husky runs lint-staged (eslint + prettier on staged ts/tsx files)
- ESLint binary lives in `apps/ui/node_modules` — lint-staged uses `pnpm -C apps/ui exec eslint`

## Important Reminders

1. Use `pnpm` (not npm) for package management
2. API routes are defined in `apps/ui/vite.config.ts` as Vite plugin middleware
3. Session files live in `.review/sessions/` (gitignored)
4. Built dist is committed to git for zero-build plugin installation
