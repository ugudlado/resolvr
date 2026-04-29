# Resolvr — Claude Instructions

## Project Overview

**Project**: resolvr
**Repository**: VS Code extension for code review with inline comments, diff rendering, and AI-assisted thread resolution

## Quick Start

```bash
make build          # Builds (and installs deps automatically if needed)
make type-check     # Type-check (also auto-installs deps)
make                # List all available targets
```

> Most `make` targets depend on a `node_modules` sentinel that re-runs `pnpm install` whenever `package.json` or `pnpm-lock.yaml` is newer — so you rarely need to install manually. If you want to force it, run `make deps` (or `pnpm install` directly).

## Project Structure

```
src/                        — Extension source (TypeScript)
  extension.ts              — Extension entry point (activate/deactivate)
  config.ts                 — VS Code settings reader (target branch, coding agent)
  sessionStore.ts           — File-based session CRUD
  sessionWatcher.ts         — FileSystemWatcher for live session updates
  branchDetector.ts         — Watches .git/HEAD for branch changes
  statusBar.ts              — Status bar state machine (detecting → ready → review)
  changedFilesTree.ts       — TreeDataProvider for Changed Files sidebar
  threadsTree.ts            — TreeDataProvider for review threads sidebar
  diffPanelManager.ts       — Diff tree population and tab opening
  diffParser.ts             — Git diff output parser
  gitDiff.ts                — Git diff subprocess runner
  baseContentProvider.ts    — TextDocumentContentProvider for base-revision files
  fileDecorationProvider.ts — File decoration badges (added/modified/deleted)
  commentManager.ts         — VS Code CommentController integration
  threadMapper.ts           — Maps session threads to VS Code comment ranges
  agentInvoker.ts           — AI agent spawner for thread resolution
  skillGenerator.ts         — Generates .review/AGENTS.md for AI agents
dist/                       — esbuild bundle output (NOT committed, gitignored)
Makefile                    — Build/package/install shortcuts (run `make` for help)
.claude/commands/           — Project-level slash commands (release-prep)
.claude/skills/             — Project-level skill guides (vscode-ext, github)
assets/                     — Extension marketplace assets (icon.png, demo.gif)
specs/                      — Feature specifications (archived)
docs/images/                — Screenshots for README
.review/                    — Runtime session storage (gitignored)
```

## Commands

Prefer `make` targets — they wrap the underlying `pnpm` scripts so contributors and agents share one entry point.

```bash
make                # Show all Makefile targets (default)
make build          # Build extension bundle (esbuild → dist/extension.js)
make watch          # Watch mode for development
make type-check     # TypeScript type checking
make package        # Package .vsix for distribution (builds first)
make install        # Build + package + install into VS Code
make format         # Format all source files (Prettier)
make knip           # Dead code detection (run before merge, not pre-commit)
make knip-fix       # Auto-remove safe unused exports
make dev            # Type-check then build
make clean          # Remove build artifacts (dist/, *.vsix)
```

## Development

Press **F5** in VS Code to launch the Extension Development Host for testing. The `Output` panel → "Resolvr" channel shows runtime logs.

## Architecture

- **Serverless**: Reads/writes session files directly — no HTTP server dependency
- **Build**: esbuild bundles into single CJS `dist/extension.js`; `vscode` module externalized
- **Sidebar**: TreeDataProviders for changed files and threads in SCM panel
- **Comments**: Native VS Code CommentController API for inline annotations
- **File watching**: `vscode.workspace.createFileSystemWatcher` for live session updates
- **AI resolution**: "Resolve with AI" command spawns configured coding agent via terminal

## Settings

No environment variables required. The extension reads from VS Code settings:

- **`resolvr.defaultTargetBranch`** — Branch to diff against (default: auto-detected `main`/`master`)
- **`resolvr.codingAgent`** — AI agent for "Resolve with AI" (`claude` | `codex` | `gemini`)

## Code Quality

- **Prettier**: Config at `.prettierrc`
- **Pre-commit**: Husky runs lint-staged (Prettier on staged files) then `make type-check`
- **Knip**: Run `make knip` before merging to detect dead exports, unused files, and unused dependencies

## Important Reminders

1. **Package manager**: Use `pnpm` (not npm); dependencies locked via pnpm-lock.yaml
2. **Session files**: Live in `.review/sessions/` (gitignored); created when user saves review sessions
3. **dist/ is NOT committed**: Always run `make build` before `make package` (or just `make package`, which builds first)

## Gotchas

- **Never edit `dist/`**: Always work in `src/`
- **Worktree `.git` is a file**: Git worktrees have a `.git` file (not directory) pointing to the parent repo. Use `git rev-parse --git-common-dir` to find the real repo root
- **AI review flow**: `skillGenerator.ts` writes `.review/AGENTS.md` at runtime with session context so AI agents can read thread data. The `.review/` directory is gitignored.
- **Activation**: Extension activates on `workspaceContains:.review/` or `onStartupFinished` — effectively always-on once installed
