# Changelog

## 1.1.0 — 2026-04-29

- Toggle comment visibility from the status bar (eye icon)
- Working-tree changes now render on the default branch instead of an empty tree
- Add comments on any branch — the default branch no longer blocks new threads

* Comment views moved from Source Control to the Explorer sidebar
* Empty Changed Files state simplified to "No changes detected."
  ! Comments resolved by Claude reflect immediately, no window reload needed
  ! Resolving from the threads tree now updates the inline editor widget too
  ! First-comment auto-created sessions hydrate the file watcher right away

## 1.0.2 — 2026-04-06

- Diff tree refreshes automatically on file save, create, delete, or rename
- Pick which branch to diff against from the Changed Files header or settings
- Changed files show up without needing a review session first
- Status bar tracks branch state: detecting, ready, or in review

* Branch detection works on any branch, not just feature/\* ones
* Codex agent uses `codex exec` for non-interactive runs
  ! Diff no longer breaks when `main` ref is missing (falls back to `master`)
  ! Fixed branch detection on non-feature branches

## 1.0.1 — 2026-04-02

- Fix demo GIF not rendering on marketplace

## 1.0.0 — 2026-04-02

- Extension icon and marketplace branding
- "Resolve with AI" — agent-native code review with skill generator and AI thread resolution

* Rebranded from local-code-review to Resolvr
* Flattened monorepo to single-package VS Code extension
* Enabled esbuild minification
* Refreshed README with demo GIF

- Removed server, UI, plugin, and scripts — VS Code extension only
