# Local Review — Claude Instructions

## Project Overview

**Project**: local-code-review
**Repository**: VS Code extension for local code review with inline comments, diff rendering, and AI-assisted thread resolution

## Quick Start

```bash
pnpm install                       # Install dependencies
pnpm -C apps/vscode build         # Build extension bundle
pnpm -C apps/vscode type-check    # Type-check
```

## Project Structure

```
.claude/commands/   — Project-level slash commands (release-prep)
.claude/skills/     — Project-level skill guides (vscode-ext, github)
openspec/           — Feature specifications (archived)
docs/images/        — Screenshots for README
apps/vscode/        — VS Code extension (esbuild + vscode API)
  src/extension.ts           — Extension entry point (activate/deactivate)
  src/SessionStore.ts        — File-based session CRUD
  src/SessionWatcher.ts      — FileSystemWatcher for live updates
  src/ChangedFilesProvider.ts — TreeDataProvider for SCM sidebar
  src/ThreadsProvider.ts     — TreeDataProvider for review threads
  src/DiffPanelManager.ts    — Webview panel for diff rendering
  src/CommentManager.ts      — VS Code CommentController integration
  dist/                      — esbuild bundle output (NOT committed, gitignored)
.review/sessions/   — Runtime session storage (gitignored)
```

## Commands

```bash
# VS Code Extension
pnpm -C apps/vscode build         # Build extension bundle (esbuild → dist/extension.js)
pnpm -C apps/vscode watch         # Watch mode for development
pnpm -C apps/vscode type-check    # TypeScript type checking
pnpm -C apps/vscode exec vsce package --no-dependencies  # Package .vsix

# Code quality (run from repo root)
pnpm type-check    # TypeScript type checking (shortcut)
pnpm lint          # Type-check (alias for type-check)
pnpm format        # Format all source files (Prettier)
pnpm knip          # Dead code detection (run before merge, not pre-commit)
pnpm knip:fix      # Auto-remove safe unused exports
```

## Architecture

### VS Code Extension (apps/vscode)

- **Serverless**: Reads/writes session files directly — no HTTP server dependency
- **Build**: esbuild bundles into single CJS `dist/extension.js`; `vscode` module externalized
- **Sidebar**: TreeDataProviders for changed files and threads in SCM panel
- **Comments**: Native VS Code CommentController API for inline annotations
- **File watching**: `vscode.workspace.createFileSystemWatcher` for live session updates
- **AI resolution**: "Resolve with AI" command spawns configured coding agent via terminal

## Environment

No environment variables required. The extension reads configuration from VS Code settings.

## Code Quality

- **ESLint**: `apps/vscode/eslint.config.js` (ESLint 9 flat config, `recommendedTypeChecked`)
- **Prettier**: Config at `.prettierrc`
- **Pre-commit**: Husky runs lint-staged (ESLint + Prettier on staged files) then `pnpm type-check`
- **Key type-aware rules**: `no-floating-promises` (error) — always `await` or `void` async calls; `no-misused-promises` (error) — don't pass async functions as void callbacks directly
- **Knip**: Run `pnpm knip` before merging to detect dead exports, unused files, and unused dependencies

## Important Reminders

1. **Package manager**: Use `pnpm` (not npm); dependencies locked via pnpm-lock.yaml
2. **Session files**: Live in `.review/sessions/` (gitignored); created when user saves review sessions
3. **VS Code dist is NOT committed**: `apps/vscode/dist/` is gitignored — always run `pnpm -C apps/vscode build` before `vsce package`

## Gotchas

- **Never edit `dist/`**: Always work in `src/`
- **Worktree `.git` is a file**: Git worktrees have a `.git` file (not directory) pointing to the parent repo. Use `git rev-parse --git-common-dir` to find the real repo root
