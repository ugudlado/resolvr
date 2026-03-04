---
description: Open the local code review UI in the browser
argument-hint: "[session-file] — optional: load a specific saved session"
---

# Open Local Review UI

Start the review UI so you can browse diffs and add inline comments.

## Steps

1. Check if the UI dev server is already running:
   ```bash
   lsof -i :3000 | grep LISTEN
   ```

2. If not running, start it:
   ```bash
   cd $CLAUDE_PLUGIN_ROOT/.. && pnpm dev
   ```
   Wait ~3 seconds for Vite to start, then open: http://localhost:3000

3. If a session file was provided (`$ARGUMENTS`), tell the user:
   > Session file: `.review/sessions/$ARGUMENTS`
   > In the UI, use "Load Session" to restore it.

4. Summarize what the UI provides:
   - Branch selector (source vs target)
   - Commit-by-commit navigation (`[` / `]` keys)
   - Click `+` on any diff line to add a thread
   - Drag across lines for multi-line comments
   - Save Session button to persist threads to `.review/sessions/`

5. Once threads are saved, run `/review-resolve` to let Claude address them.
