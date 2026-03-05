# 2026-03-05-auto-resolve-daemon: Auto-Resolve Daemon

## Overview

When a reviewer clicks "Request Changes" in the review UI, Claude automatically resolves all open threads without manual `/resolve` invocation. A persistent Claude CLI process ("resolver daemon") cold-starts when the Vite dev server boots, then resumes for each resolve request — accumulating context across cycles.

## Development Mode

**Mode**: Non-TDD

## Requirements

### Must Have

- [ ] Cold-start a Claude CLI session when the Vite dev server starts, capturing the session ID
- [ ] Automatically trigger thread resolution when verdict changes to `changes_requested`
- [ ] Resume the existing Claude session (via `--resume <session_id>`) for each resolve request
- [ ] Support both code and spec session types
- [ ] Update resolved threads via existing PATCH API endpoints
- [ ] Show resolving status in the UI (spinner + completion summary)
- [ ] Serialize resolve requests (prevent concurrent runs)

### Nice to Have

- [ ] Manual "Resolve with Claude" button for re-triggering without changing verdict
- [ ] Per-feature session IDs (currently one global daemon)

## Architecture

### Approach: Persistent Claude CLI Daemon

The Vite server manages a Claude CLI process lifecycle:

1. **Cold start** (server boot): Spawn `claude -p` with resolver context, capture `session_id` from JSON output
2. **Warm invoke** (on verdict change): Spawn `claude -p --resume <session_id>` with the specific session file to resolve
3. **Session accumulation**: Each resolve cycle adds to conversation history, giving Claude context about prior resolutions

### Components

- **`resolver-daemon.ts`** (new): Module managing Claude CLI lifecycle — cold start, resolve, status
- **`vite.config.ts`** (modify): Hook into `configureServer` for cold start; detect verdict changes in session POST handlers
- **`ReviewVerdict.tsx` area** (modify): Show resolving status indicator via WebSocket events

### Data Flow

```
Server Start
    │
    ▼
claude -p "<resolver system prompt>"
  --output-format json  →  capture session_id
    │
    ▼  (session_id stored in server memory)

"Request Changes" clicked in UI
    │
    ▼
POST /features/:id/{code|spec}-session  (verdict: "changes_requested")
    │
    ▼  (Vite server detects verdict change)
    │
    ├─→ WebSocket: review:resolve-started
    │
    ▼
claude -p "Resolve threads in .review/sessions/{file}.json"
  --resume <session_id>
  --allowedTools "Read,Edit,Grep,Glob,Bash"
  --output-format json
    │
    ▼
For each resolved thread:
  PATCH /local-api/features/:id/{type}-session/threads/:threadId
    │
    ├─→ File watcher detects session change → WebSocket: review:session-updated
    │
    ▼
WebSocket: review:resolve-completed → UI shows summary
```

### Files to Create/Modify

- `apps/ui/src/server/resolver-daemon.ts` — new module: Claude CLI lifecycle management
- `apps/ui/vite.config.ts` — import daemon, cold-start in `configureServer`, detect verdict in POST handlers
- `apps/ui/src/components/shared/ReviewVerdict.tsx` — add resolving status indicator
- `apps/ui/src/hooks/useResolveStatus.ts` — new hook: listen for resolve WebSocket events

### Claude CLI Invocation

**Cold start:**

```bash
claude -p "You are a review resolver for the local-review project.
Your working directory is <cwd>.
When asked to resolve threads, use scripts/review-context.sh to extract
context for code threads, or read the spec file directly for spec threads.
After resolving, PATCH results to the local API at localhost:37002.
Acknowledge ready." \
  --output-format json \
  --allowedTools "Read,Edit,Grep,Glob,Bash"
```

**Resolve request (resumed):**

```bash
claude -p "Resolve all open threads in session file:
.review/sessions/<featureId>-<type>.json
Session type: <code|spec>
Feature ID: <featureId>

For each open thread:
1. Extract context (review-context.sh for code, spec file for spec)
2. Analyze and respond
3. PATCH result to http://localhost:37002/local-api/features/<featureId>/<type>-session/threads/<threadId>

Return JSON: { resolved: number, clarifications: number, fixes: string[] }" \
  --resume <session_id> \
  --output-format json \
  --allowedTools "Read,Edit,Grep,Glob,Bash"
```

### Serialization

A simple `isResolving` flag prevents concurrent resolve runs. If a resolve is already in progress and another "Request Changes" is clicked, the request is queued (single-slot queue — latest request wins).

### WebSocket Events

| Event                      | Payload                                   | Purpose            |
| -------------------------- | ----------------------------------------- | ------------------ |
| `review:resolve-started`   | `{ featureId, threadCount }`              | Show spinner in UI |
| `review:resolve-completed` | `{ featureId, resolved, clarifications }` | Show summary       |

## Alternatives Considered

### Direct Anthropic API from Vite Server

- **Pros**: No CLI dependency, more control, could stream responses
- **Cons**: Requires API key management, loses Claude Code tooling (Read, Edit, Grep), reimplements agent runtime
- **Why rejected**: This is a Claude Code plugin — using the CLI is natural and gives us all tools for free

### File-Based Trigger with Claude Hook

- **Pros**: Decoupled, works even if Claude session starts later
- **Cons**: Requires running Claude session, more moving parts, delayed execution
- **Why rejected**: No guarantee Claude is running when trigger fires; the daemon approach ensures availability

### Fresh `claude -p` per resolve (no session resumption)

- **Pros**: Simpler, no state management
- **Cons**: No accumulated context, cold start latency on each resolve
- **Why rejected**: Session resumption gives better context and faster responses over time

## Acceptance Criteria

- [ ] Vite server cold-starts a Claude session on boot without blocking server startup
- [ ] Clicking "Request Changes" with open threads triggers automatic resolution
- [ ] Resolved threads appear in the UI without manual refresh (WebSocket push)
- [ ] Concurrent resolve requests are serialized (no race conditions)
- [ ] Works for both code review and spec review sessions
- [ ] UI shows resolving spinner and completion summary

## Open Questions

- [NEEDS CLARIFICATION: none currently]
