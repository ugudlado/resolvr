# Keyboard-Driven Code Review Navigation

## Summary

Add navigation-only keyboard shortcuts to the code review page with thread resolve/reopen actions and discoverability via help modal + subtle hints.

## Keybindings

| Key      | Action                           | Context           |
| -------- | -------------------------------- | ----------------- |
| `↑`/`↓`  | Move file selection in sidebar   | Sidebar focused   |
| `Enter`  | Open selected file               | Sidebar focused   |
| `Ctrl+K` | Fuzzy search files in review     | Global            |
| `j`/`k`  | Next/prev thread in current file | Diff view         |
| `r`      | Resolve focused thread           | Thread focused    |
| `o`      | Reopen focused thread            | Thread focused    |
| `[`/`]`  | Prev/next commit                 | Global (existing) |
| `?`      | Toggle shortcuts help modal      | Global            |

## Keyboard State

No modal system. All shortcuts are global listeners with context-awareness:

- Arrow keys only respond when sidebar has focus (prevent hijacking page scroll)
- `j`/`k`/`r`/`o` only respond when not typing in a textarea/input
- `?` suppressed when any input is focused

## Components

### 1. `useKeyboardReview` hook

Central keyboard event handler for the review page. Registers all shortcuts, manages "focused thread" index, delegates to existing hooks (`useDiffNavigation` for `[`/`]`).

### 2. Sidebar arrow navigation

`FileSidebar` gains `selectedIndex` state. `↑`/`↓` move the index, `Enter` triggers file selection. Visual highlight on the active item.

### 3. Thread focus cycling

`j`/`k` cycle through threads in the current file's diff. Scrolls the thread into view and adds a visual focus ring. Tracks `focusedThreadIndex` in the hook.

### 4. `Ctrl+K` enhancement

The existing `CommandPalette` component gets a "files in review" source, showing changed files with their thread counts. Selecting a file navigates to it.

### 5. `ShortcutHelpModal`

Reuse the pattern from SpecReviewPage's `ShortcutHelp`. Table of all keybindings, toggled with `?`.

### 6. Subtle hints

Small `kbd` tags next to sidebar file items (`↑↓`) and thread nav arrows (`j k`). Shown on first render, fade after a few uses (localStorage counter).

## Data Flow

```
keydown event
  → useKeyboardReview
    → is input focused? → ignore
    → match key:
      ↑/↓  → update selectedIndex in FileSidebar
      Enter → call onFileSelect(files[selectedIndex])
      j/k   → update focusedThreadIndex, scroll to thread
      r     → call resolveThread(focusedThread.id)
      o     → call reopenThread(focusedThread.id)
      ?     → toggle help modal
      Ctrl+K → open CommandPalette with file source
```

## Out of Scope

- No vim-like modal modes
- No verdict shortcuts (a/x)
- No spec review page changes
- No view toggle or hunk expand shortcuts
