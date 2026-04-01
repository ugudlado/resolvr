# Design: Keyboard-Driven Code Review Navigation

## Context

The code review page (`ReviewPage.tsx`, 1023 LOC) supports mouse-driven file selection, thread interaction, and commit navigation. Only `[`/`]` commit shortcuts exist via `useDiffNavigation`. The spec review page has `j`/`k` and `?` but uses a completely separate implementation. This design adds keyboard navigation to the code review page as a self-contained feature.

## Goals / Non-Goals

### Goals

- Keyboard navigation for files, threads, and thread actions on the code review page
- Discoverability via help modal and subtle hints
- Zero new dependencies
- Non-interfering with existing mouse workflows

### Non-Goals

- Vim-like modal system (Normal/Insert/Command modes)
- Verdict shortcuts (`a`/`x` for approve/request-changes)
- Spec review page keyboard unification
- Custom keybinding configuration
- View toggle or hunk expand shortcuts

## Technical Design

### Components

#### `useKeyboardReview` hook

**Location**: `apps/ui/src/hooks/useKeyboardReview.ts`

**Responsibilities**:

- Registers a single `keydown` listener on `document`
- Guards against input/textarea focus for letter keys
- Guards against non-sidebar focus for arrow keys
- Manages state: `selectedFileIndex`, `focusedThreadIndex`, `showHelp`
- Calls provided callbacks: `onFileSelect`, `onThreadResolve`, `onThreadReopen`

**Interface**:

```typescript
interface UseKeyboardReviewOptions {
  files: string[]; // ordered file list from sidebar
  threads: ReviewThread[]; // pre-filtered to current file, ordered by line number (derived from threadsByLine)
  selectedFile: string | null; // currently viewed file
  sidebarRef: RefObject<HTMLElement>; // sidebar container for focus detection
  onFileSelect: (path: string) => void;
  onThreadFocus: (thread: ReviewThread) => void;
  onThreadResolve: (threadId: string) => void;
  onThreadReopen: (threadId: string) => void;
  onOpenPalette: () => void; // trigger Ctrl+K
}

interface UseKeyboardReviewReturn {
  selectedFileIndex: number;
  focusedThreadIndex: number;
  focusedThread: ReviewThread | null;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}
```

#### `FileSidebar` modifications

**File**: `apps/ui/src/components/sidebar/FileSidebar.tsx`

Changes:

- Accept `selectedIndex` prop for keyboard-driven highlight
- Add `tabIndex={0}` to make sidebar focusable
- Render `ring-2 ring-accent-blue` on the item at `selectedIndex`
- Show `KeyboardHint` (`↑↓`) next to file list header when sidebar is focused

#### `CommandPalette` modifications

**File**: `apps/ui/src/components/shared/CommandPalette.tsx`

Changes:

- Accept `reviewFiles` prop: `Array<{ path: string; threadCount: number }>`
- Add review files to the existing `"Files"` group (matches hardcoded group iteration in CommandPalette)
- Show thread count badge next to each file entry

#### Thread focus system

**Integration point**: `ReviewPage.tsx`

- `focusedThreadIndex` from hook drives a CSS class on the matching thread widget
- On `j`/`k`, the thread element is scrolled into view via `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Focus ring: `ring-2 ring-amber-400/60` on the focused thread's container

#### `ShortcutHelp` modifications

**File**: `apps/ui/src/components/shared/ShortcutHelp.tsx`

Changes:

- Refactor to accept a `shortcuts` prop: `Array<{ key: string; description: string; group: string }>`
- Remove hardcoded shortcut table — each page passes its own bindings
- `SpecReviewPage` passes spec-specific shortcuts (existing behavior preserved)
- `ReviewPage` passes code-review shortcuts (new)
- This resolves the `r` conflict: spec page shows `r = Reply`, code page shows `r = Resolve`

#### `KeyboardHint`

**Location**: `apps/ui/src/components/shared/KeyboardHint.tsx`

- Renders inline `<kbd>` styled badges (e.g., `↑↓`, `j k`)
- Reads/increments a localStorage counter (`keyboard-hints-seen`)
- After threshold (5 mounts, incremented in useEffect cleanup-free mount), returns null
- Subtle styling: `text-xs opacity-50 bg-surface-2 rounded px-1`

### Data Flow

```
ReviewPage
├── useKeyboardReview(files, threads, callbacks)
│   ├── keydown listener on document
│   ├── selectedFileIndex → FileSidebar[selectedIndex]
│   ├── focusedThreadIndex → thread focus ring in diff view
│   └── showHelp → ShortcutHelpModal
├── FileSidebar
│   ├── tabIndex={0} for focusability
│   ├── selectedIndex highlight
│   └── KeyboardHint("↑↓")
├── CommandPalette
│   └── reviewFiles source added
└── DiffThreadNav / thread widgets
    ├── focusedThread highlight
    └── KeyboardHint("j k")
```

### Error Handling

- If `focusedThreadIndex` exceeds thread count (threads resolved/removed), clamp to last valid index
- If `selectedFileIndex` exceeds file count (file list changes), reset to 0
- If sidebar loses focus during arrow key nav, no-op (guard check)
- `scrollIntoView` on a detached element is a no-op (safe)

## Risks & Trade-offs

| Risk                                         | Mitigation                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrow keys conflict with diff view scrolling | Guard: `sidebarRef.current.contains(document.activeElement)` — fires when sidebar or any child has focus. Child buttons don't have their own arrow handlers so no double-navigation risk. |
| `Ctrl+K` conflicts with browser address bar  | `preventDefault()` in handler — standard pattern used by VS Code, GitHub                                                                                                                  |
| Thread count changes while navigating        | Clamp index on every render via `Math.min(index, threads.length - 1)`                                                                                                                     |
| Hints becoming annoying                      | localStorage fade after 5 views; conservative styling                                                                                                                                     |

## Open Questions

None — design is fully specified from brainstorming.
