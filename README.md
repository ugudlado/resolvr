# Resolvr

VS Code extension for code review — review diffs, leave threaded comments inline, and resolve them with AI assistance. Reviews are stored as local session files, keeping everything private and version-control friendly.

## Features

- **Inline comments** — Native VS Code Comments API for threaded annotations on any line
- **Changed files tree** — Source Control sidebar shows changed files with diff stats
- **Diff panel** — Dedicated webview for side-by-side diff rendering
- **File watching** — Live updates when session files change on disk
- **AI resolution** — "Resolve with AI" spawns your configured coding agent to address open threads
- **Serverless** — Reads/writes session files directly, no server dependency

![VS Code extension showing changed files tree, inline review comments, and threads panel](docs/images/vscode-extension.png)

## Install

From the VS Code Marketplace:

```bash
code --install-extension ugudlado.resolvr
```

Or download from the [latest release](https://github.com/ugudlado/resolvr/releases) and install manually:

```bash
code --install-extension resolvr-<version>.vsix
```

## How It Works

1. **Review** — Open changed files in the sidebar, add threaded comments on any line
2. **Discuss** — Reply to threads, mark as resolved or re-open
3. **Resolve with AI** — Click the status bar button or use the command palette to spawn your coding agent on open threads
4. **Continue** — See AI replies inline, resolve or follow up

Review sessions are stored in `.review/sessions/` as JSON files — portable, diffable, and private.

## Development

```bash
git clone https://github.com/ugudlado/resolvr.git
cd resolvr
pnpm install
```

```bash
pnpm build          # Build extension bundle
pnpm watch          # Watch mode for development
pnpm type-check     # TypeScript type checking
pnpm format         # Format all files (Prettier)
```

### Packaging

```bash
pnpm package
```

### Debug in VS Code

Press F5 to launch the Extension Development Host (configured in `.vscode/launch.json`).

For more development details, see [CLAUDE.md](./CLAUDE.md).

## Contributing

1. Fork the repo and create a feature branch
2. `pnpm install`
3. Make your changes — validate with `pnpm type-check`
4. Build: `pnpm build`
5. Open a pull request

## License

MIT — see [LICENSE](./LICENSE)
