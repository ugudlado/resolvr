---
name: vscode-ext
description: Use when working on the VS Code extension at apps/vscode/ — building, packaging, versioning, installing, type-checking, or developing extension features. Triggers when user mentions "vscode extension", "build extension", "package vsix", "extension version", "vsce", "extension development", or when modifying files under apps/vscode/.
---

# VS Code Extension Development

Guide for developing, building, and packaging the local-review VS Code extension.

## Extension Overview

- **Location**: `apps/vscode/`
- **Entry point**: `src/extension.ts` → bundled to `dist/extension.js`
- **Bundler**: esbuild (CJS format, `vscode` externalized)
- **Package manager**: pnpm (never npm)
- **Current version**: Check `apps/vscode/package.json` `version` field

## Commands Reference

All commands run from the **repo root** using `pnpm -C apps/vscode`:

| Task               | Command                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Build              | `pnpm -C apps/vscode build`                                               |
| Watch (dev)        | `pnpm -C apps/vscode watch`                                               |
| Type-check         | `pnpm -C apps/vscode type-check`                                          |
| Package .vsix      | `pnpm -C apps/vscode exec vsce package --no-dependencies`                 |
| Install in VS Code | `code --install-extension apps/vscode/local-review-vscode-<version>.vsix` |
| Version bump       | `pnpm -C apps/vscode version patch\|minor\|major --no-git-tag-version`    |

## Build & Package Workflow

### Quick build

```bash
pnpm -C apps/vscode build
```

### Full package (build → .vsix)

```bash
pnpm -C apps/vscode build && pnpm -C apps/vscode exec vsce package --no-dependencies
```

### Build + package + install

```bash
pnpm -C apps/vscode build && \
pnpm -C apps/vscode exec vsce package --no-dependencies && \
code --install-extension apps/vscode/local-review-vscode-*.vsix
```

After installing, remind the user to reload VS Code (`Developer: Reload Window`).

## Versioning

### Standalone version bump

```bash
pnpm -C apps/vscode version patch --no-git-tag-version
```

Use `--no-git-tag-version` to avoid git tags — tagging is handled by `/release-prep` for full releases.

### Full release versioning

Use `/release-prep` which bumps all package versions in sync (root, UI, server, plugin, marketplace, and VS Code extension).

## Architecture

```
apps/vscode/
├── src/
│   ├── extension.ts          # Extension entry point (activate/deactivate)
│   ├── SessionStore.ts       # File-based session CRUD operations
│   ├── SessionWatcher.ts     # FileSystemWatcher for .review/ changes
│   ├── ChangedFilesProvider.ts  # TreeDataProvider for SCM sidebar
│   ├── ThreadsProvider.ts    # TreeDataProvider for review threads
│   ├── DiffPanelManager.ts   # Webview panel for diff rendering
│   └── CommentManager.ts     # VS Code CommentController integration
├── dist/
│   └── extension.js          # esbuild bundle output (gitignored)
├── package.json              # Extension manifest + contributes
├── tsconfig.json             # TypeScript config (noEmit, bundler resolution)
└── .vscodeignore             # Files excluded from .vsix package
```

### Key patterns

- **Serverless architecture**: Extension reads/writes session files directly (no HTTP server dependency)
- **File watchers**: `SessionWatcher` uses `vscode.workspace.createFileSystemWatcher` for live updates
- **TreeDataProvider**: `ChangedFilesProvider` and `ThreadsProvider` power the SCM sidebar views
- **CommentController**: Native VS Code comment API for inline thread annotations
- **esbuild bundling**: All dependencies bundled into single CJS file; only `vscode` is external

## Gotchas

- **Always use pnpm**: Never npm. All commands go through pnpm.
- **`--no-dependencies` for vsce**: Required because dependencies are bundled by esbuild, not shipped in `node_modules`.
- **dist/ is gitignored**: Unlike `apps/server/dist` and `apps/ui/dist`, the VS Code extension dist is NOT committed. Always build before packaging.
- **esbuild doesn't type-check**: Run `pnpm -C apps/vscode type-check` separately — the build step skips type checking.
- **Reload after install**: VS Code requires window reload (`Developer: Reload Window`) to pick up extension changes.
- **`.vscodeignore` matters**: Controls what goes into the `.vsix`. Source files (`src/`), `node_modules/`, and `tsconfig.json` are excluded.
- **`vscode` module is external**: Never bundle the `vscode` module — it's provided by the VS Code runtime. esbuild config uses `--external:vscode`.

## Validation Checklist

Before packaging a release:

1. `pnpm -C apps/vscode type-check` — passes with no errors
2. `pnpm -C apps/vscode build` — produces `dist/extension.js`
3. Version in `apps/vscode/package.json` matches intended release
4. `pnpm -C apps/vscode exec vsce package --no-dependencies` — produces `.vsix`
5. Test install: `code --install-extension <path>.vsix` → reload → verify activation
