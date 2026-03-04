---
description: Load a review session and let Claude resolve all open threads
argument-hint: "[session-file] — filename in .review/sessions/ (omit to use latest)"
---

# Resolve Review Threads

Load a saved review session and address every open thread. Claude will:
- Reply to each thread with a clear answer
- Apply code fixes directly when the fix is unambiguous and complete context is available
- Ask a clarifying question inside the thread when context is missing or the fix is ambiguous

## Steps

### 1. Find the session file

If `$ARGUMENTS` is provided, use `.review/sessions/$ARGUMENTS`.

Otherwise, find the most recent session:
```bash
ls -t .review/sessions/*.json 2>/dev/null | head -1
```

If no sessions exist, tell the user to save one from the review UI first.

### 2. Read the session

```bash
cat .review/sessions/<session-file>
```

Parse the JSON. Extract:
- `threads[]` — all thread objects
- `sourceBranch`, `targetBranch`, `allDiff` — context

### 3. Filter open threads

Work only on threads where `status === "open"`.

For each open thread, note:
- `filePath` — which file
- `line` / `lineEnd` — line range (on `side`: "old" or "new")
- `messages[]` — conversation so far (show as context)

### 4. For each open thread — launch the review-resolver agent

Launch a `local-review:review-resolver` agent for each open thread in parallel (up to 5 at a time). Pass:
- The thread object as JSON
- The relevant file content (read the actual file from disk)
- The diff hunk around the thread's lines (extracted from `allDiff`)

### 5. Collect agent results

Each resolver returns:
```json
{
  "threadId": "...",
  "reply": "...",
  "codeFixApplied": true | false,
  "fixedFiles": ["path/to/file"],
  "needsClarification": false
}
```

### 6. Update the session file

For each thread that was resolved:
- Append the agent's reply message to `thread.messages` with `authorType: "agent"`, `author: "claude"`
- Set `thread.status` to `"resolved"` (or keep `"open"` if clarification was requested)
- Update `thread.lastUpdatedAt`

Write the updated session back to the same file.

### 7. Report

Print a summary:
- ✅ N threads resolved
- 💬 N threads with clarification questions (still open)
- 🔧 N code fixes applied (list files changed)

Tell the user to refresh the review UI to see Claude's responses.
