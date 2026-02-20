---
description: Reply to a specific review thread by ID
argument-hint: "<thread-id> [session-file]"
---

# Reply to a Specific Thread

Address a single thread by its ID. Useful when you want Claude to focus on one specific comment.

## Steps

### 1. Parse arguments

`$ARGUMENTS` format: `<thread-id> [session-file]`

- `threadId` = first word
- `sessionFile` = second word (or latest session if omitted)

### 2. Find the session

```bash
ls -t .review/sessions/*.json 2>/dev/null | head -1
```

Read the session JSON and find the thread with matching `id`.

If not found, list all thread IDs from the session so the user can pick.

### 3. Show thread context

Print the thread details:
- File: `filePath` lines `line`-`lineEnd` (`side` side)
- Status: `status`
- Messages: show the conversation

### 4. Launch review-resolver agent

Launch a `local-review:review-resolver` agent for this single thread with:
- Full thread JSON
- The actual file content from disk
- The diff hunk around the thread's lines

### 5. Update session

Apply the agent's reply to the session file (same as review-resolve step 6).

### 6. Report

Confirm the reply was added and whether a code fix was applied.
Tell the user to refresh the UI.
