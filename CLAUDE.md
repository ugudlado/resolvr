# Local Review Plugin — Claude Instructions

## Project Overview

**Project**: local-review
**Repository**: Claude Code plugin for local code review with browser UI and VS Code extension

## Quick Start

```bash
pnpm install           # Install dependencies for all workspaces
pnpm dev               # Start standalone server at http://localhost:37003
pnpm -C apps/ui dev    # Start Vite dev server (for UI development with HMR)
```

**Note**: All `pnpm` commands run from the repository root. Use `-C apps/ui` or `-C apps/server` prefix when running app-specific commands.

## Project Structure

```
.claude-plugin/     — Plugin metadata
commands/           — Slash commands (open, resolve)
agents/             — Subagent definitions (review-resolver)
hooks/              — Session hooks (auto-start dev server)
scripts/            — Shell scripts (context extraction)
openspec/changes/   — Active and archived feature specifications
skills/             — Auto-triggered skill guides (vscode-ext, github)
apps/server/        — Standalone Hono server (REST API + WebSocket + static UI)
  src/middleware/    — Request middleware (repo context resolution)
  src/workspaces.ts — Workspace registry (multi-repo support)
  src/types.ts      — Shared server types (AppEnv)
  dist/             — Bundled output via esbuild (committed for zero-build install)
  cjs-shim.js       — CJS compatibility shim for ESM bundle
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
  src/hooks/        — Custom React hooks (useRepoContext, useFeaturesContext, etc.)
  src/pages/        — Page components (Dashboard, ReviewPage, TasksPage)
  src/services/     — API clients (localReviewApi, featureApi)
  src/styles/       — CSS themes (terminal-luxe)
  src/types/        — TypeScript type definitions
  src/utils/        — Diff parsing, spec anchoring, task parsing
  eslint.config.js  — ESLint 9 flat config (TypeScript + React)
  dist/             — Built output (committed for zero-build install)
apps/vscode/        — VS Code extension (esbuild + vscode API)
  src/extension.ts  — Extension entry point (activate/deactivate)
  src/SessionStore.ts    — File-based session CRUD
  src/SessionWatcher.ts  — FileSystemWatcher for live updates
  src/ChangedFilesProvider.ts — TreeDataProvider for SCM sidebar
  src/ThreadsProvider.ts — TreeDataProvider for review threads
  src/DiffPanelManager.ts — Webview panel for diff rendering
  src/CommentManager.ts  — VS Code CommentController integration
  dist/             — esbuild bundle output (NOT committed, gitignored)
docs/plans/         — Design documents (local only, gitignored)
.review/sessions/   — Runtime session storage (gitignored)
```

## Commands

Run all commands from the repository root. App-specific commands use `pnpm -C apps/ui`:

```bash
# Server (run from repo root)
pnpm dev                      # Start standalone server (tsx watch mode)
pnpm start                    # Start server from bundled dist/
pnpm -C apps/server build     # Rebuild server bundle (esbuild → dist/index.js)

# VS Code Extension (run from repo root)
pnpm -C apps/vscode build         # Build extension bundle (esbuild → dist/extension.js)
pnpm -C apps/vscode watch         # Watch mode for development
pnpm -C apps/vscode type-check    # TypeScript type checking
pnpm -C apps/vscode exec vsce package --no-dependencies  # Package .vsix

# UI Development (run from repo root)
pnpm -C apps/ui dev           # Start Vite dev server at http://localhost:37003
pnpm -C apps/ui build         # Build UI for production

# Testing (Vitest, config: apps/ui/vitest.config.unit.ts)
pnpm -C apps/ui test:unit     # Run unit tests
pnpm -C apps/ui test:watch    # Run tests in watch mode
pnpm -C apps/ui test:coverage # Run tests with coverage report
pnpm -C apps/ui test:ui       # Open Vitest UI dashboard

# Code quality (run from repo root)
pnpm type-check    # TypeScript type checking (both app and node configs)
pnpm lint          # Lint all files (both workspaces — ESLint 9 flat config)
pnpm format        # Format all source files (Prettier + Tailwind plugin)
pnpm knip          # Dead code detection across both workspaces (run before merge, not pre-commit)
pnpm knip:fix      # Auto-remove safe unused exports
```

**Port Configuration**: Change default port 37003 by setting `PORT` env var (works for both server and UI dev):

```bash
PORT=3000 pnpm dev              # standalone server on port 3000
PORT=3000 pnpm -C apps/ui dev   # Vite dev server on port 3000
```

## Architecture

### Server (apps/server)

- **Framework**: Hono on Node.js HTTP server
- **API**: REST endpoints for sessions, features, specs, tasks, context, workspaces
- **Multi-repo**: Repo middleware resolves workspace context per-request; workspace registry persists repos in `~/.config/local-review/workspaces.json`
- **Real-time**: WebSocket push for session and git state changes (chokidar file watcher)
- **Build**: esbuild bundles all deps (hono, ws, chokidar) into single `dist/index.js` for zero-install plugin support
- **Externals**: `vite` (dev-only) and `@anthropic-ai/claude-agent-sdk` (resolver daemon) are not bundled
- **Static**: Serves `apps/ui/dist/` for production; in dev mode, proxies to Vite

### UI (apps/ui)

- **Framework**: React 18 with Vite 5
- **Routing**: React Router with feature-based layout (FeatureLayout + FeatureNavBar)
- **State**: Zustand with Immer middleware
- **Styling**: Tailwind CSS
- **API**: All REST endpoints live in `apps/server/src/routes/` (Hono). In dev mode, Hono serves API routes and embeds Vite as HMR middleware — no API logic in `vite.config.ts`

### VS Code Extension (apps/vscode)

- **Serverless**: Reads/writes session files directly — no HTTP server dependency
- **Build**: esbuild bundles into single CJS `dist/extension.js`; `vscode` module externalized
- **Sidebar**: TreeDataProviders for changed files and threads in SCM panel
- **Comments**: Native VS Code CommentController API for inline annotations
- **File watching**: `vscode.workspace.createFileSystemWatcher` for live session updates

### Plugin

- **Commands**: Markdown-based slash commands for Claude Code
- **Agent**: `review-resolver` subagent processes individual review threads
- **Hooks**: `SessionStart` hook auto-starts the server via `node apps/server/dist/index.js`

## Testing

- **Framework**: Vitest with `@vitest/ui` dashboard
- **Config**: `apps/ui/vitest.config.unit.ts`
- **Coverage**: View HTML report with `pnpm -C apps/ui coverage:html`
- **Files**: Tests colocate with source files (`.test.ts` / `.test.tsx`)

## Environment

```bash
# Optional environment variables:
PORT=3000           # Change server/UI dev port (default: 37003)

# No other env vars required for basic usage
```

## Code Quality

- **ESLint**: `apps/ui/eslint.config.js` and `apps/server/eslint.config.js` (ESLint 9 flat config, `recommendedTypeChecked`)
- **Prettier**: Config at `.prettierrc` with Tailwind CSS plugin
- **Pre-commit**: Husky runs lint-staged (ESLint + Prettier on staged files) then `pnpm type-check`
- ESLint binary lives in workspace `node_modules` — lint-staged uses `pnpm -C apps/ui exec eslint` and `pnpm -C apps/server exec eslint`
- **Key type-aware rules**: `no-floating-promises` (error) — always `await` or `void` async calls; `no-misused-promises` (error) — don't pass async functions as void callbacks directly
- **Knip**: Run `pnpm knip` before merging to detect dead exports, unused files, and unused dependencies

## Important Reminders

1. **Workspace commands**: Use `pnpm -C apps/ui` for app-specific commands; use bare `pnpm` for repo-root commands
2. **Package manager**: Use `pnpm` (not npm); dependencies locked via pnpm-lock.yaml
3. **API routes**: All routes live exclusively in `apps/server/src/routes/` — no duplication in `vite.config.ts`
4. **Session files**: Live in `.review/sessions/` (gitignored); created when user saves review sessions
5. **Built dist**: `apps/ui/dist/` and `apps/server/dist/` are committed to git for zero-build plugin installation; `apps/vscode/dist/` is NOT committed (gitignored — build before packaging)
6. **Server bundle**: Run `pnpm -C apps/server build` after changing server code; bundles all deps via esbuild
7. **Plugin layout**: Source files live at repo root (`.claude-plugin/`, `commands/`, `agents/`, `hooks/`, `scripts/`) — do not create copies in subdirectories
8. **Pre-commit hooks**: Husky runs lint-staged on staged files (ESLint + Prettier) before commit

## Gotchas

- **Never edit `dist/`**: Always work in `src/`; use `PORT=3003 pnpm -C apps/ui dev` for UI dev with HMR
- **API routes are NOT duplicated**: All routes live in `apps/server/src/routes/` only — `vite.config.ts` has no API logic
- **Server bundle not auto-rebuilt**: Run `pnpm -C apps/server build` after any server-side change; committed `dist/index.js` is what the plugin uses at runtime
- **VS Code dist is NOT committed**: Unlike server and UI, `apps/vscode/dist/` is gitignored. Always run `pnpm -C apps/vscode build` before `vsce package`
- **Worktree `.git` is a file**: Git worktrees have a `.git` file (not directory) pointing to the parent repo. Use `git rev-parse --git-common-dir` to find the real repo root — `path.basename()` on a worktree path gives the worktree folder name, not the repo name
