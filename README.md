# local-review

GitHub-style local code review plugin for Claude Code. Review diffs in a browser UI, add inline threaded comments, then let Claude resolve them — replying to questions, applying fixes when clear, or asking for clarification when not.

## Install

**Step 1:** Add the marketplace (one-time):

```
claude plugin marketplace add ugudlado/claude-marketplace
```

**Step 2:** Install the plugin:

```
claude plugin install local-review@ugudlado
```

**Step 3:** Open the review UI:

```
/local-review:open
```

![Code review UI showing file tree, inline diff with threaded comments, and thread resolution](docs/images/review-ui.png)

## Features

### Review diffs in a browser UI

Browse code changes with syntax highlighting. Click `+` on any line to start a threaded comment, or drag across multiple lines to create multi-line threads.

### Inline thread comments

Add detailed review comments directly on code. Threads are persisted to `.review/sessions/*.json` and survive across sessions.

### Resolve threads via UI or CLI

Trigger resolution from the UI with the "Request changes" button, or run it directly from Claude Code:

```
/local-review:resolve
```

Claude reads every open thread, replies with analysis, applies code fixes where unambiguous, and asks clarifying questions when needed.

### Thread resolution via subagent

The `review-resolver` subagent processes each thread independently, deciding whether to:

- Apply a fix → when issue is clear and solution is unambiguous
- Reply with explanation → when the comment asks "why"
- Ask a clarifying question → when context is missing or multiple valid approaches exist

## Commands

| Command                           | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| `/local-review:open [session]`    | Open the review UI, optionally load a saved session         |
| `/local-review:resolve [session]` | Resolve all open threads in the latest or specified session |

## Workflow

1. **Open the UI** — `/local-review:open [session]`
   Browse diffs and add threaded comments.

2. **Save the session** — Click "Save Session" in the UI
   Persists threads to `.review/sessions/*.json`

3. **Resolve threads** — `/local-review:resolve [session]`
   Claude replies to each comment thread.

4. **See replies** — Refresh the UI to view Claude's responses inline

## Architecture

The plugin ships with two apps:

- **`apps/server`** — Standalone Hono server (REST API + WebSocket). Built with esbuild into a single bundled `dist/index.js` for zero-install plugin support.
- **`apps/ui`** — React frontend (Vite + Tailwind). Built dist committed to git, served as static files by the server.

The `SessionStart` hook auto-starts the server via `node apps/server/dist/index.js` — no `pnpm install` or build step needed after plugin installation.

## Development

```bash
git clone https://github.com/ugudlado/local-review.git
cd local-review
pnpm install
pnpm dev                      # Start server (tsx watch mode)
pnpm -C apps/ui dev           # Start Vite dev server (HMR for UI work)
```

```bash
pnpm -C apps/server build     # Rebuild server bundle (esbuild)
pnpm -C apps/ui build         # Build UI for production
pnpm -C apps/ui test:unit     # Run unit tests
pnpm type-check               # Type-check all workspaces
```

For more development details (workspace commands, architecture, gotchas), see [CLAUDE.md](./CLAUDE.md).

## Contributing

1. Fork the repo and create a feature branch
2. `pnpm install && pnpm dev`
3. Make your changes — validate with `pnpm type-check`
4. Rebuild server if changed: `pnpm -C apps/server build`
5. Open a pull request

## License

MIT — see [LICENSE](./LICENSE)
