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
   - `--repo <path>` — scope the dashboard to a specific repository (overrides auto-detection)
   - No flags, no arguments — open the dashboard scoped to the current working directory
   - Plain argument with no flag (legacy) — treat as a session filename

   **Repo auto-detection**: When no `--repo` flag is provided, detect the git root of the current working directory and use it as the `repo` parameter. This ensures the dashboard always shows features for the project the user is working in.

   ```bash
   # Auto-detect repo root from CWD
   REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   ```

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
   # Derive workspace name from repo directory basename
   WORKSPACE_NAME=$(basename "$REPO_ROOT")

   # Register workspace with the server (idempotent)
   curl -s -X POST "http://localhost:37003/api/workspaces/register" \
     -H "Content-Type: application/json" \
     -d "{\"path\": \"$REPO_ROOT\"}" >/dev/null 2>&1 || true

   # Default — dashboard scoped to current workspace
   open "http://localhost:37003?workspace=$WORKSPACE_NAME"

   # With explicit --repo (full path override)
   open "http://localhost:37003?repo=<path>"

   # Standalone with source branch and/or worktree pre-selected
   open "http://localhost:37003?workspace=$WORKSPACE_NAME&source=<branch>"
   open "http://localhost:37003?workspace=$WORKSPACE_NAME&worktree=<encoded-path>"

   # With --spec / --code / --tasks (include workspace param)
   open "http://localhost:37003/features/$FEATURE_ID/code?workspace=$WORKSPACE_NAME"
   open "http://localhost:37003/features/$FEATURE_ID/tasks?workspace=$WORKSPACE_NAME"
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
