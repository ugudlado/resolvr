# Proposal: Keyboard-Driven Code Review Navigation

## Why

The code review page (ReviewPage) requires heavy mouse interaction for file navigation, thread jumping, and thread actions. The spec review page already has `j`/`k` thread cycling and `?` help, but code review only has `[`/`]` for commit navigation. Reviewers who prefer keyboard workflows lose time reaching for the mouse to switch files, scroll to threads, and resolve comments.

## What Changes

Add keyboard shortcuts to the code review page for file navigation (arrow keys in sidebar, `Ctrl+K` file search), thread cycling (`j`/`k`), thread actions (`r`/`o` resolve/reopen), and a help modal (`?`). Include subtle keyboard hint badges for discoverability.

## Capabilities

### New

- Arrow key navigation in file sidebar (up/down to select, Enter to open)
- `Ctrl+K` enhanced to fuzzy-search files within the current review session
- `j`/`k` thread cycling within the current file's diff view
- `r` to resolve and `o` to reopen the currently focused thread
- `?` help modal showing all available shortcuts
- Subtle `kbd` hint badges on sidebar items and thread nav

### Modified

- `FileSidebar` — gains keyboard selection state and visual focus indicator
- `CommandPalette` — gains "files in review" data source
- `DiffThreadNav` — gains focused thread tracking with scroll-into-view

## Alternatives Considered

- **hotkeys-js library** — Lightweight keyboard shortcut library. Not needed since React's synthetic events and `useEffect` listeners are sufficient for this scope. No cross-browser edge cases at play.
- **react-hotkeys-hook** — Popular React hook for keyboard shortcuts. Evaluated but adds a dependency for ~15 keybindings that are straightforward to implement with a custom hook. Would consider if scope grows significantly.
- **Vim modal system** — Full vim-like modes (Normal/Insert/Command). Rejected as over-engineering for navigation-only scope. Can be added later if demand exists.
- **tinykeys** — ~400B keyboard shortcut library. Minimal but adds a dependency for something achievable with native event listeners.

## Impact

- No breaking changes — all shortcuts are additive
- No API changes — purely UI-side
- Existing mouse workflows unchanged
- `Ctrl+K` behavior enhanced but backward-compatible (adds a source, doesn't remove existing ones)

## Linear Ticket

none
