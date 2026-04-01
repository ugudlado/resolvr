# Specification: Agent-Native Code Review via VS Code Extension

## Motivation

The local-code-review project currently has three surfaces: a web UI (React), a standalone server (Hono), and a VS Code extension. The extension is already the most natural review environment — developers live in VS Code, and the extension already handles threads, diffs, verdicts, and session persistence without needing the server.

The missing piece is **agent integration**. Today, agents participate in reviews through the Claude Code plugin (commands + resolver agent), which requires the server running and specific Claude Code knowledge. Other coding agents (Cursor, Copilot, Codex) have no way to participate.

This feature makes the VS Code extension the **primary review interface** and adds an **agent skill generator** that produces native instruction files for any configured coding agent. The result: any developer using any coding agent gets a complete review workflow without needing the web UI.

## Architecture

### Data Layer (unchanged)

Session files remain the universal data layer:

```
~/.config/local-review/workspace/{repoName}/sessions/{featureId}-code.json
```

Both VS Code and agents read/write these files. The VS Code extension's file watcher detects external changes (agent writes) and updates the UI in real-time.

### Skill Generation

The extension generates agent-native skill files in the workspace when activated:

```
.review/skills/claude-code/    → SKILL.md (+ commands/)
.review/skills/cursor/         → .cursorrules fragment
.review/skills/copilot/        → copilot-instructions.md fragment
.review/skills/codex/          → AGENTS.md fragment
.review/skills/gemini/         → GEMINI.md instructions
```

These files teach the agent how to read/write session files, create threads, reply, resolve, and set verdicts — using the session JSON schema directly. No server dependency.

### Extension Enhancement

The extension gains a new "Skill Generator" that:

1. Reads the configured agent(s) from settings
2. Generates/updates skill files on activation and branch change
3. Injects workspace-specific context (repo name, session paths, current feature)

## Requirements

### R1: Extension setting for coding agent selection

Add a multi-select setting `localReview.codingAgents` that accepts an array of agent identifiers:

- `claude-code` — Claude Code (generates SKILL.md)
- `cursor` — Cursor (generates .cursorrules content)
- `copilot` — GitHub Copilot (generates copilot-instructions.md content)
- `codex` — OpenAI Codex CLI (generates AGENTS.md content)
- `gemini` — Google Gemini CLI (generates GEMINI.md instructions)

Default: `["claude-code"]`. The setting appears in the extension's configuration section with checkboxes.

### R2: Skill file generation on activation

When the extension activates (feature branch detected or review started), it generates skill files for each configured agent in `.review/skills/{agent}/`. Generation also triggers on:

- Branch change (new feature detected)
- Setting change (agent list modified)
- Manual command: "Local Review: Regenerate Agent Skills"

The generated files are **workspace-scoped** — they contain the current repo name, session directory path, feature ID, and branch name. They are regenerated (not appended) on each trigger.

### R3: Claude Code skill format

Generate `.review/skills/claude-code/SKILL.md` with:

```markdown
---
description: "Code review for {repoName} — create, read, reply to, and resolve review threads"
---

# Code Review Skill for {repoName}

## Session Location

{sessionFilePath}

## Session Schema

{JSON schema for CodeReviewSession}

## Available Operations

- **Read review state**: Parse session JSON for threads, verdict, metadata
- **Create thread**: Add new thread to `threads[]` array with anchor, status, severity, messages
- **Reply to thread**: Append message to existing thread's `messages[]` array
- **Resolve thread**: Update thread `status` to "resolved", add resolution message
- **Set verdict**: Update `reviewVerdict` to "changes_requested" or null
- **Mark outdated**: Set thread `status` to "outdated" when code has changed

## Thread Anchor Format

{DiffLineAnchor schema with filePath, line, side, lineContent, lineContentHash}

## Message Format

{ReviewMessage schema with id, authorType, author, text, createdAt}

## Rules

- Always set `authorType: "agent"` and `author: "{agentName}"` on messages you create
- Generate UUID v4 for new thread/message IDs
- Update `lastUpdatedAt` on the thread when modifying it
- Update `metadata.updatedAt` on the session when modifying it
- Write the full session JSON back atomically (read → modify → write)
```

### R4: Cursor skill format

Generate `.review/skills/cursor/.cursorrules` with equivalent instructions adapted for Cursor's rule format — a flat markdown file that Cursor loads as system context. Same operations and schema, but formatted as Cursor rules with `@file` references to the session path.

### R5: Copilot skill format

Generate `.review/skills/copilot/copilot-instructions.md` with equivalent instructions in GitHub Copilot's instruction format. References the session file path and provides the JSON schema inline.

### R6: Codex CLI skill format

Generate `.review/skills/codex/AGENTS.md` with equivalent instructions in Codex CLI's agent format. Includes the session schema and operation descriptions.

### R6b: Gemini CLI skill format

Generate `.review/skills/gemini/GEMINI.md` with equivalent instructions for Google Gemini CLI. Follows Gemini's instruction format — markdown with structured sections for context, schema, and operations. Same session schema and operations as other formats.

### R7: Skill context injection

Each generated skill file includes workspace-specific context:

- `repoName`: from `git rev-parse` (worktree-aware)
- `featureId`: current feature branch ID (e.g., `agent-native-review`)
- `sessionFilePath`: absolute path to the active session JSON
- `branchName`: current git branch
- `targetBranch`: the merge target (typically `main`)
- `changedFiles`: list of files in the diff (so agents know what to review)

This context is refreshed on every regeneration trigger (R2).

### R8: Gitignore `.review/skills/`

Ensure `.review/skills/` is added to `.gitignore` since skill files are workspace-local and regenerated. The extension checks and appends to `.gitignore` if the pattern is missing.

### R9: Status bar indicator for active skills

The existing status bar item gains an additional indicator showing which agent skills are active. Clicking it opens a quick pick to regenerate skills or change the agent configuration.

### R10: VS Code command for manual skill regeneration

Register command "Local Review: Regenerate Agent Skills" that forces a regeneration of all configured skill files. Useful after manual session edits or configuration changes.

## Non-Goals

- **Dashboard/task board/spec viewer in VS Code**: Not needed — the workspace context (branch, files, diff) is sufficient.
- **MCP server**: Future consideration. Skill files are simpler and work offline.
- **Web UI removal**: Gradual transition — both coexist for now.
- **Server dependency**: Generated skills are serverless — they teach agents to read/write session files directly.

## Design Decisions

### Why skill files over MCP?

Skill files are:

1. **Zero-dependency** — no server, no protocol, no connection management
2. **Portable** — work with any agent that reads instruction files
3. **Inspectable** — developers can read and understand what the agent will do
4. **Offline** — work without network connectivity

MCP could be added later for richer capabilities (streaming, structured tool calls), but skill files cover 90% of the need with 10% of the complexity.

### Why `.review/skills/` over project root?

Keeps agent files organized and easily gitignored. Doesn't pollute the project root with `.cursorrules` or other agent-specific files that may conflict with existing configurations.

### Why regenerate on branch change?

The skill file contains the current feature ID, session path, and changed files. These change per branch, so the skill must be regenerated to stay accurate. This is cheap (string templating) and ensures the agent always has correct context.

## Implementation Notes

### Skill Template Engine

Create a `SkillGenerator` class in `apps/vscode/src/skillGenerator.ts` that:

1. Takes a `SkillContext` (repoName, featureId, sessionPath, branch, changedFiles)
2. Has format-specific renderers: `renderClaudeCode()`, `renderCursor()`, `renderCopilot()`, `renderCodex()`, `renderGemini()`
3. Writes files to `.review/skills/{agent}/` using `vscode.workspace.fs`

### Session Schema Export

The session JSON schema (thread structure, anchor format, message format) should be defined once and embedded in each skill format. Consider extracting a `SESSION_SCHEMA.md` that the generator reads and injects.

### File Watcher Integration

The existing `SessionWatcher` already detects external session file changes. No changes needed — when an agent modifies the session JSON, the extension will pick up changes automatically via the existing watcher.

### Testing

- Unit tests for each format renderer (given context → expected output)
- Integration test: generate skill → verify file written to correct path
- Manual test: use generated Claude Code skill to create a thread, verify it appears in VS Code
