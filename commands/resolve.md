---
description: Load a review session (spec or code) and resolve all open threads in this Claude session
argument-hint: "[--spec|--code] [feature-id] or [session-file] — resolve spec or code review threads"
---

# Resolve Review Threads

Load a saved review session and address every open thread directly in this Claude session — no subagents. Claude will work through each thread sequentially, applying fixes and replying via the local API.

## Steps

### 1. Find the session file

Parse `$ARGUMENTS` to determine the session type and file:

- **`--spec [feature-id]`**: Find `.review/sessions/*-spec.json` matching the feature ID
- **`--code [feature-id]`**: Find `.review/sessions/*-code.json` matching the feature ID
- **`[session-file]`** (no flag): Use `.review/sessions/$ARGUMENTS` directly
- **No arguments**: Fall back to the most recent session (any type)

```bash
# With --spec flag:
ls -t .review/sessions/*-spec.json 2>/dev/null | head -1

# With --code flag:
ls -t .review/sessions/*-code.json 2>/dev/null | head -1

# No arguments — most recent session of any type:
ls -t .review/sessions/*.json 2>/dev/null | head -1
```

If no sessions exist, tell the user to save one from the review UI first.

### 2. Read the session and detect type

```bash
cat .review/sessions/<session-file>
```

Detect session type:

- **Code session**: has `sourceBranch` and `targetBranch` fields
- **Spec session**: has a `specPath` or `specFile` field

Extract: `featureId`, `threads[]`.

### 3. Filter open threads

Work only on threads where `status === "open"`. If none, report "No open threads" and stop.

### 4. Resolve each thread (sequentially, in this session)

For each open thread, extract context then analyze and act:

#### Code threads

```bash
bash scripts/review-context.sh .review/sessions/<session-file> <threadId>
```

This returns JSON with `fileContext`, `diffHunk`, and `messages`. Use it to:

- Understand what the reviewer commented on (anchor line + diff hunk)
- Apply the fix with the Edit tool if it's unambiguous
- Or reply with explanation / clarifying question

#### Spec threads

Read the spec file directly. Locate the section via `thread.anchor.sectionPath` and `thread.anchor.blockIndex`. Use the Edit tool to revise the spec if needed.

#### Decision rules (same for both types)

- **Apply fix** — issue is clear, fix is unambiguous, self-contained
- **Reply with explanation** — reviewer asking "why", or code is correct as-is
- **Ask clarification** — intent unclear, multiple valid approaches, missing context

### 5. PATCH each thread via API

After handling each thread, immediately update it:

```bash
curl -s -X PATCH http://localhost:37003/local-api/features/<featureId>/<code|spec>-session/threads/<threadId> \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "<resolved|open>",
    "messages": [{
      "authorType": "agent",
      "author": "claude",
      "text": "<your reply>",
      "createdAt": "<ISO timestamp>"
    }]
  }'
```

Use `"status": "open"` when asking a clarifying question. Use `"status": "resolved"` otherwise.

### 6. Report

Print a summary:

- N threads resolved
- N threads with clarification questions (still open)
- Files changed (if any fixes applied)
