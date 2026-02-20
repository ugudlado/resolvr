# Review Project

Local-first monorepo for reviewing code changes and sending structured feedback to coding agents.

## What It Does

- Reads local `git diff` directly from the repo.
- Renders a GitHub-style unified diff view.
- Supports inline conversation threads per changed line.
- Uses GitHub-style line commenting (`+` on hover, drag to select line range).
- Tracks thread state as `open`, `resolved`, or `approved`.
- Supports worktree selection and target branch comparison (default: `main`).
- Lets you filter diff view to `all`, `committed`, or `uncommitted` changes.
- Stores review sessions as JSON in `.review/sessions` in this same repository.

## Local Development

```bash
pnpm install
pnpm dev
```

- UI: `http://localhost:3000`
- Local review API (inside Vite middleware): `/local-api/*`

Optional full stack mode (legacy server + UI):

```bash
pnpm dev:full
```

## Session Storage

Each saved review session includes:

- session name
- summary notes
- worktree path + source/target branch
- selected diff mode (`all`, `committed`, `uncommitted`)
- full diff snapshot
- threaded conversations (`filePath`, `line`, `side`, `messages[]`, `status`)

Sessions are written to:

```text
.review/sessions/*.json
```

## Current Scope

- Local-only review workflow.
- No dedicated backend API required for review operations.
- Designed so plugin/agent adapters can read session files and return targeted fixes.
