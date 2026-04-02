# Resolvr — Claude Instructions

## Project Overview

**Project**: resolvr
**Repository**: VS Code extension for code review with inline comments, diff rendering, and AI-assisted thread resolution

## Quick Start

```bash
pnpm install        # Install dependencies
pnpm build          # Build extension bundle
pnpm type-check     # Type-check
```

## Project Structure

```
src/                — Extension source (TypeScript)
  extension.ts      — Extension entry point (activate/deactivate)
  sessionStore.ts   — File-based session CRUD
  sessionWatcher.ts — FileSystemWatcher for live updates
  changedFilesTree.ts — TreeDataProvider for SCM sidebar
  threadsTree.ts    — TreeDataProvider for review threads
  diffPanelManager.ts — Webview panel for diff rendering
  commentManager.ts — VS Code CommentController integration
  agentInvoker.ts   — AI agent spawner for thread resolution
  skillGenerator.ts — Agent skill file generator
dist/               — esbuild bundle output (NOT committed, gitignored)
.claude/commands/   — Project-level slash commands (release-prep)
.claude/skills/     — Project-level skill guides (vscode-ext, github)
openspec/           — Feature specifications (archived)
docs/images/        — Screenshots for README
.review/            — Runtime session storage (gitignored)
```

## Commands

```bash
pnpm build          # Build extension bundle (esbuild → dist/extension.js)
pnpm watch          # Watch mode for development
pnpm type-check     # TypeScript type checking
pnpm package        # Package .vsix for distribution
pnpm format         # Format all source files (Prettier)
pnpm knip           # Dead code detection (run before merge, not pre-commit)
pnpm knip:fix       # Auto-remove safe unused exports
```

## Architecture

- **Serverless**: Reads/writes session files directly — no HTTP server dependency
- **Build**: esbuild bundles into single CJS `dist/extension.js`; `vscode` module externalized
- **Sidebar**: TreeDataProviders for changed files and threads in SCM panel
- **Comments**: Native VS Code CommentController API for inline annotations
- **File watching**: `vscode.workspace.createFileSystemWatcher` for live session updates
- **AI resolution**: "Resolve with AI" command spawns configured coding agent via terminal

## Environment

No environment variables required. The extension reads configuration from VS Code settings.

## Code Quality

- **Prettier**: Config at `.prettierrc`
- **Pre-commit**: Husky runs lint-staged (Prettier on staged files) then `pnpm type-check`
- **Knip**: Run `pnpm knip` before merging to detect dead exports, unused files, and unused dependencies

## Important Reminders

1. **Package manager**: Use `pnpm` (not npm); dependencies locked via pnpm-lock.yaml
2. **Session files**: Live in `.review/sessions/` (gitignored); created when user saves review sessions
3. **dist/ is NOT committed**: Always run `pnpm build` before `pnpm package`

## Gotchas

- **Never edit `dist/`**: Always work in `src/`
- **Worktree `.git` is a file**: Git worktrees have a `.git` file (not directory) pointing to the parent repo. Use `git rev-parse --git-common-dir` to find the real repo root
