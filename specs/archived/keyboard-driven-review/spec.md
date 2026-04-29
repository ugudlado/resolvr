---
mode: non-tdd
feature-id: 2026-03-09-keyboard-driven-review
linear-ticket: none
---

# Specification: Keyboard-Driven Code Review Navigation

## Overview

Add keyboard shortcuts to the code review page for navigating files, cycling through threads, resolving/reopening threads, and discovering shortcuts via a help modal. Extends the existing `[`/`]` commit navigation to create a comprehensive keyboard-driven review experience.

## Requirements

### Functional

1. Arrow keys (`↑`/`↓`) navigate file selection in the sidebar when sidebar is focused
2. `Enter` opens the currently selected file in the diff view
3. `Ctrl+K` (or `Cmd+K` on macOS) opens the command palette with review files as a searchable source
4. `j`/`k` cycle to the next/previous thread in the current file (filtered by selected file path, ordered by line number), scrolling it into view
5. `r` resolves the currently focused thread
6. `o` reopens the currently focused thread
7. `?` toggles a keyboard shortcuts help modal
8. All letter-key shortcuts (`j`, `k`, `r`, `o`, `?`) are suppressed when an input or textarea is focused
9. Arrow key shortcuts only fire when the file sidebar has focus
10. A visual focus indicator highlights the currently selected file in the sidebar
11. A visual focus ring highlights the currently focused thread in the diff view
12. Subtle `kbd` hint badges appear on sidebar items and thread nav arrows

### Non-Functional

1. No new dependencies — implement with native event listeners and React hooks
2. Keyboard hints should be non-intrusive and fade after a few uses (localStorage counter)
3. Shortcuts must not interfere with browser defaults (e.g., `Ctrl+K` in address bar — handled by `preventDefault`)

## Architecture

### Components

- `useKeyboardReview` — New hook: central keyboard event handler, manages focused file index and focused thread index
- `FileSidebar` — Modified: accepts `selectedIndex` and `onKeyboardSelect` props, renders focus highlight
- `CommandPalette` — Modified: accepts additional `reviewFiles` data source
- `DiffThreadNav` — Modified: exposes `focusedThreadId` and scroll-to behavior
- `ShortcutHelp` — Modified: existing component accepts page-specific shortcuts prop instead of hardcoded table
- `KeyboardHint` — New component: small `kbd` badge, fades after N renders

### Data Flow

```
keydown → useKeyboardReview
  ├── ↑/↓ → selectedFileIndex state → FileSidebar highlight
  ├── Enter → onFileSelect(selectedFile)
  ├── j/k → focusedThreadIndex state → scroll thread into view + focus ring
  ├── r → resolveThread(focusedThread.id)
  ├── o → reopenThread(focusedThread.id)
  ├── ? → showHelp state → ShortcutHelpModal
  └── Ctrl+K → CommandPalette open with review files source
```

## Acceptance Criteria

- Given the sidebar is focused, when I press `↓`, then the next file in the list is highlighted
- Given a file is highlighted in the sidebar, when I press `Enter`, then that file's diff is shown
- Given I press `Ctrl+K`, when I type a filename, then matching review files appear and selecting one navigates to it
- Given a file has 3 threads, when I press `j` three times, then each thread is focused in sequence and scrolled into view
- Given a thread is focused, when I press `r`, then the thread is resolved
- Given a resolved thread is focused, when I press `o`, then the thread is reopened
- Given I press `?`, then a modal shows all available keyboard shortcuts
- Given I am typing in a comment textarea, when I press `j`, then nothing happens (shortcut suppressed)
- Given keyboard hints are shown, after 5 page loads they fade and are no longer displayed

## Decisions

1. **No new dependencies** — Native event listeners are sufficient for ~10 keybindings. Keeps bundle size unchanged.
2. **Non-modal design** — Context-aware shortcuts (sidebar focus vs. diff focus) instead of vim-like modes. Simpler mental model.
3. **Code review page only** — Spec review page already has its own shortcuts. Unification deferred to avoid scope creep.
4. **localStorage for hint fading** — Simple counter increments on component mount (not every render); after 5 mounts, hints hidden. No server-side state needed.
5. **Extend existing ShortcutHelp** — Reuse the existing `ShortcutHelp.tsx` component by making it accept a `shortcuts` prop. Each page passes its own bindings. No duplicate modal components.
