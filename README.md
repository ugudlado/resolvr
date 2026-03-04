# local-review

GitHub-style local code review plugin for Claude Code. Review diffs in a browser UI, add inline threaded comments, then let Claude resolve them — replying to questions, applying fixes when clear, or asking for clarification when not.

## Install

```bash
claude --plugin-dir /path/to/review
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["/path/to/review"]
}
```

## Recommended Companion Plugin

This plugin works best with [pr-review-toolkit](https://github.com/anthropics/claude-code-plugins) for automated code review agents (code-reviewer, silent-failure-hunter, code-simplifier, etc.). Install it alongside local-review:

```bash
claude install-plugin pr-review-toolkit
```

## Workflow

1. **Open the UI** — `/local-review:open`
   Browse diffs, click `+` on lines to comment, drag for multi-line threads.

2. **Save the session** — click "Save Session" in the UI
   Persists threads to `.review/sessions/*.json`

3. **Let Claude resolve** — `/local-review:resolve`
   Claude reads every open thread, replies with analysis, applies code fixes where unambiguous, and asks questions when context is missing.

4. **Refresh the UI** — see Claude's replies inline

## Commands

| Command                           | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| `/local-review:open [session]`    | Open the review UI, optionally load a session               |
| `/local-review:resolve [session]` | Resolve all open threads in the latest or specified session |

## Agent

**review-resolver** — reads a thread + its code context and decides:

- Apply a fix → when issue is clear and solution is unambiguous
- Reply with explanation → when the comment asks "why"
- Ask a clarifying question → when context is missing or multiple valid approaches exist

## Development

```bash
pnpm install
pnpm dev          # Start Vite dev server at http://localhost:37002
pnpm build        # Build for production (output in src/apps/ui/dist/)
pnpm test:unit    # Run tests
```

## Session Storage

Sessions are saved to `.review/sessions/` as JSON files. They contain threads and messages from both humans and Claude (marked with `authorType: "agent"`).
