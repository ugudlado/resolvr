# local-review

GitHub-style local code review plugin for Claude Code. Review diffs in a browser UI, add inline threaded comments, then let Claude resolve them — replying to questions, applying fixes when clear, or asking for clarification when not.

## Setup

```bash
# Start the review UI
pnpm dev   # from repo root — starts Vite at http://localhost:3000
```

## Workflow

1. **Open the UI** — `/review-open`
   Browse diffs, click `+` on lines to comment, drag for multi-line threads.

2. **Save the session** — click "Save Session" in the UI
   Persists threads to `.review/sessions/*.json`

3. **Let Claude resolve** — `/review-resolve`
   Claude reads every open thread, replies with analysis, applies code fixes where unambiguous, and asks questions when context is missing.

4. **Refresh the UI** — see Claude's replies inline

5. **Target a single thread** — `/review-reply <thread-id>`
   Focus Claude on one specific comment.

## Commands

| Command | Description |
|---------|-------------|
| `/review-open [session-file]` | Open the UI and optionally load a session |
| `/review-resolve [session-file]` | Resolve all open threads in the latest (or specified) session |
| `/review-reply <thread-id> [session-file]` | Reply to a specific thread by ID |

## Agent

**review-resolver** (magenta) — reads a thread + its code context and decides:
- Apply a fix → when issue is clear and solution is unambiguous
- Reply with explanation → when the comment asks "why"
- Ask a clarifying question → when context is missing or multiple valid approaches exist

## Session Storage

Sessions are saved to `.review/sessions/` as JSON files. They contain the full diff, all threads, and messages from both humans and Claude (marked with `authorType: "agent"`).
