# Design — VS Code Sidebar Diff Panel

## Architecture

No new components. Three small modifications to existing files:

### 1. `apps/vscode/package.json`

**Remove `when` clause** from the `localReview.changedFiles` view so it always appears:

```json
"views": {
  "local-review": [
    {
      "id": "localReview.changedFiles",
      "name": "Changed Files"
    }
  ]
}
```

**Add `viewsWelcome`** for empty state messaging:

```json
"viewsWelcome": [
  {
    "view": "localReview.changedFiles",
    "contents": "No review session active.\n[Open Diff](command:local-review.openDiff)",
    "when": "!local-review.hasDiffPanel"
  }
]
```

### 2. `apps/vscode/src/extension.ts`

In the `init()` function, after successfully loading a session, call `diffPanelManager.open(featureId)` to auto-populate the tree:

```typescript
// After session load succeeds:
await diffPanelManager.open(featureId);
```

Similarly in the `onDidChangeFeature` handler — when a new feature's session loads, populate the diff tree.

### 3. `apps/vscode/src/diffPanelManager.ts`

The `open()` method already does everything needed (fetches diff, populates tree, sets context key). No changes required to this file.

## Trade-offs

- **Always-visible empty tree vs hidden tree**: We choose always-visible because VS Code's `viewsWelcome` provides good UX for empty states, and the activity bar icon serves as a discovery point.
- **Auto-load on init**: Adds one extra API call on activation (to fetch diff), but this is acceptable since it only fires when a session exists.
