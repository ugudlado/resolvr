---
description: Open the review UI dashboard, or navigate to a specific feature view
argument-hint: "[--spec|--code|--tasks <feature-id>] [--source <branch>] [--worktree <path>]"
---

# Open Local Review UI

Start the review UI so you can browse the dashboard or jump directly into a feature view.

## Steps

1. Parse `$ARGUMENTS` to detect flags:
   - `--spec <feature-id>` — open the spec review for that feature
   - `--code <feature-id>` — open the code review for that feature
   - `--tasks <feature-id>` — open the tasks view for that feature
   - `--source <branch>` — pre-select this branch as the compare branch (standalone mode only)
   - `--worktree <path>` — pre-select this worktree path (standalone mode only)
   - No flags, no arguments — open the dashboard or standalone review
   - Plain argument with no flag (legacy) — treat as a session filename

2. Check if the UI dev server is already running:

   ```bash
   lsof -i :37003 | grep LISTEN
   ```

3. If not running, start it:

   ```bash
   cd ~/code/review && pnpm -C apps/ui dev
   ```

   Wait ~3 seconds for Vite to start.

4. Build and open the URL based on the detected mode:

   ```bash
   # Default — dashboard / standalone review
   open http://localhost:37003

   # Standalone with source branch and/or worktree pre-selected
   # URL-encode the values if they contain special characters (e.g. / → %2F)
   open "http://localhost:37003?source=<branch>"
   open "http://localhost:37003?worktree=<encoded-path>"
   open "http://localhost:37003?source=<branch>&worktree=<encoded-path>"

   # With --spec / --code / --tasks
   open http://localhost:37003/features/$FEATURE_ID/spec
   open http://localhost:37003/features/$FEATURE_ID/code
   open http://localhost:37003/features/$FEATURE_ID/tasks
   ```

   Note: The `open` command requires disabling the sandbox since it needs macOS Launch Services.

5. If a plain session filename was provided (no flag, legacy behavior), tell the user:

   > Session file: `.review/sessions/$ARGUMENTS`
   > In the UI, use "Load Session" to restore it.

6. Summarize what the UI provides based on the mode opened:
   - **Dashboard**: feature list, pipeline progress, quick actions
   - **Spec review**: inline annotation, discussion threads, tasks sidebar
   - **Code review**: diff view, inline comments, verdict controls
   - **Tasks view**: phase progress, task status tracking

7. Once threads are saved, run `/resolve` to let Claude address them.
