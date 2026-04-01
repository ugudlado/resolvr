# Tasks: Keyboard-Driven Code Review Navigation

## Phase 1: Core Hook & File Navigation

- [x] T-1 Create `useKeyboardReview` hook with keydown listener, input guard, and file index state
- [x] T-2 Add `selectedIndex` prop to `FileSidebar` with focus highlight and `tabIndex={0}`
- [x] T-3 Wire `useKeyboardReview` into `ReviewPage` for arrow key file navigation
- [x] T-4 Review checkpoint (phase gate)

## Phase 2: Thread Navigation & Actions

- [x] T-5 Add `focusedThreadIndex` state and `j`/`k` cycling to `useKeyboardReview` with file-scoped thread filtering by line number (depends: T-1)
- [x] T-6 Add thread focus ring CSS and `scrollIntoView` behavior in diff view (depends: T-5)
- [x] T-7 Add `r`/`o` resolve/reopen handlers to `useKeyboardReview` (depends: T-5)
- [x] T-8 Edge case handling: index clamping on file/thread list changes (depends: T-3, T-6)
- [x] T-9 Review checkpoint (phase gate)

## Phase 3: Command Palette & Help

- [x] T-10 Add `reviewFiles` source to `CommandPalette` under existing "Files" group with thread count badges [P]
- [x] T-11 Refactor `ShortcutHelp` to accept page-specific `shortcuts` prop; update `SpecReviewPage` to pass its own bindings [P]
- [x] T-12 Wire `?` toggle and `Ctrl+K` trigger into `useKeyboardReview` (depends: T-10, T-11)
- [x] T-13 Review checkpoint (phase gate)

## Phase 4: Discoverability & Polish

- [x] T-14 Create `KeyboardHint` component with localStorage mount-count fade logic [P]
- [x] T-15 Add `KeyboardHint` badges to `FileSidebar` header and `DiffThreadNav` [P] (depends: T-14)
- [x] T-16 Final review checkpoint (phase gate)

## Phase 5: Bug Fixes

- [x] T-17 Fix stale index in keyboard navigation — use mutable refs (`fileIdxRef`, `threadIdxRef`) instead of render-time state refs (depends: T-3)
- [x] T-18 Fix sidebar focus loss after re-render — call `sidebarRef.focus()` synchronously before state update (depends: T-17)
- [x] T-19 Add keyboard highlight outline to tree view file rows — use `visibleFiles.indexOf(file)` for correct index mapping (depends: T-2)
- [x] T-20 Fix arrow navigation stopping after ~6 files — sidebar didn't scroll to keep keyboard-selected file visible (depends: T-18)
  - **Root cause**: Missing `scrollIntoView` — items past the visible scroll area were highlighted but not scrolled into view
  - **Fix**: Added `data-file-index` attributes + `useEffect` with `scrollIntoView({ block: "nearest" })` in `FileSidebar`; memoized `filePaths` array in ReviewPage

## Phase 6: Headless Tree Integration

- [x] T-21 Replace custom tree view in `FileSidebar` with `@headless-tree/react` (depends: T-20)
  - **Why**: Custom `buildFolderRows` + `collapsedFolders` + keyboard nav is fragile; headless-tree provides accessible tree with built-in keyboard support
  - **Files**: `FileSidebar.tsx`, `ReviewPage.tsx`, `useKeyboardReview.ts`
  - **Done when**: Tree view renders with expand/collapse, arrow key navigation, and selection via headless-tree; custom `buildFolderRows` removed from FileSidebar
