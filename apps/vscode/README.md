# Local Code Review

Review code, leave threaded comments, and let Claude resolve them — right in VS Code.

Part of the [Local Code Review](https://github.com/ugudlado/local-review) Claude Code plugin. Works alongside the browser UI and Claude Code CLI — all three share the same session files so everything stays in sync.

## Features

### Inline comment threads

Leave review comments on any line via VS Code's native Comments API. Threads appear inline in the editor, just like GitHub PR comments.

![VS Code extension showing changed files tree, inline review comments with Claude's reply, and threads panel](https://raw.githubusercontent.com/ugudlado/local-review/main/docs/images/vscode-extension.png)

### Changed files sidebar

See all changed files with diff stats in the Source Control panel. Click any file to open the diff panel.

### Diff panel

Full diff view with inline thread annotations. Navigate between threads, resolve or re-open them without leaving the editor.

### Claude integration

When you're done reviewing, run `/local-review:resolve` in Claude Code. Claude reads every open thread and responds — applying fixes, explaining decisions, or asking clarifying questions. Replies appear inline in both VS Code and the browser UI.

### Serverless — no setup required

The extension reads and writes session files directly. No server to start, no HTTP dependency. File watchers keep VS Code in sync with the browser UI in real time.

## Requirements

- [Local Code Review Claude Code plugin](https://github.com/ugudlado/local-review) installed
- VS Code 1.85 or later

## Install

```bash
code --install-extension ugudlado.local-code-review
```

Or search for **Local Code Review** in the VS Code Extensions panel.

## Usage

1. Install the Claude Code plugin: `claude plugin install local-code-review@ugudlado`
2. Open a repo with a `.review/sessions/` directory
3. The **Local Review: Changed Files** and **Local Review: Threads** panels appear in the Source Control sidebar
4. Click a file to open the diff panel, add comments inline
5. Run `/local-review:resolve` in Claude Code to have Claude respond to threads

## Works With

The extension is one part of a three-surface review workflow:

| Surface                      | What you do                                     |
| ---------------------------- | ----------------------------------------------- |
| **VS Code** (this extension) | Inline comments, diff panel, file tree          |
| **Browser UI**               | Full review dashboard, feature view, task board |
| **Claude Code CLI**          | Resolve threads automatically with AI           |

All three read and write the same `.review/sessions/*.json` files.

## Links

- [GitHub](https://github.com/ugudlado/local-review)
- [Issues](https://github.com/ugudlado/local-review/issues)
- [Changelog](https://github.com/ugudlado/local-review/blob/main/CHANGELOG.md)

## License

MIT
