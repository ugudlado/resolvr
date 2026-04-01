# VS Code Sidebar Diff Panel — Always Visible

## Problem

The Local Review extension registers an activity bar container (`local-review`) with a "Changed Files" tree view, but the view has a `"when": "local-review.hasDiffPanel"` guard. This means:

1. The activity bar icon doesn't appear until the user manually runs `Local Review: Open Diff`
2. Users don't know the diff panel exists because there's no visual indicator
3. The extension feels "invisible" after installation

## Solution

Make the Changed Files view always visible in the activity bar when the extension activates on a feature branch with an active review session.

### Changes

1. **Remove `when` guard** from `localReview.changedFiles` view in `package.json` — the view always renders in the activity bar container
2. **Show welcome content** when no files are loaded — VS Code's `viewsWelcome` contribution point displays a message with an action button when the tree is empty
3. **Auto-populate on activation** — when `init()` successfully loads a session, also load the diff file list into the tree view so it's immediately populated

### Non-goals

- No webview-based diff rendering (that was the cancelled `vscode-webview-diff` feature)
- No changes to how diffs open (still uses `vscode.diff` command in editor tabs)
- No new UI components

## Acceptance Criteria

- [ ] Activity bar shows "Local Review" icon immediately after extension activates
- [ ] Changed Files tree shows file list when a session exists
- [ ] Empty state shows welcome message with "Open Diff" button when no session/feature
- [ ] Existing `openDiff` / `closeDiff` commands still work
- [ ] No regression in thread count badges on files
