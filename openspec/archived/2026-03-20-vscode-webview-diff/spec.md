# Spec: VS Code Webview Diff Panel

## Problem Statement

The current VS Code extension renders diffs using the native `vscode.diff` command, which opens a standard two-pane diff editor. While functional for viewing changes, this approach has fundamental limitations:

1. **No inline review threads.** Native diff editors have no mechanism to render rich inline comment cards (severity badges, markdown replies, resolve/reopen actions) at specific lines. The existing CommentManager uses VS Code's Comment API, which renders threads in a separate panel detached from the diff context.

2. **Visual inconsistency with the web UI.** The browser-based review app renders diffs with `@git-diff-view/react`, inline thread cards (`DiffInlineThread`), compose forms (`ComposeWidget`), text selection popovers, and a dark theme matching the project's design tokens. The native VS Code diff shares none of this.

3. **Context switching.** Reviewers who use both the browser UI and VS Code see two completely different diff experiences. Thread data is the same, but the presentation diverges.

The goal is to embed a webview-based diff panel inside VS Code that reuses the web UI's React diff components, providing a consistent review experience without leaving the editor.

## Requirements

### Functional

- **R1**: Register a `WebviewViewProvider` that renders in the `local-review` sidebar container, below the existing `changedFiles` tree view.
- **R2**: The webview renders a unified diff for the currently selected file using a forked `DiffViewWrapper` (adapted from `apps/ui/src/components/diff/` with Tailwind/shadcn dependencies removed).
- **R3**: Inline review threads (`DiffInlineThread`) appear at their anchored lines within the webview diff, matching the web UI's presentation.
- **R4**: Users can add new comments via the "+" button on diff lines (the widget slot mechanism from `@git-diff-view/react`).
- **R5**: Users can reply to, resolve, and reopen threads directly in the webview.
- **R6**: Thread data synchronizes in real-time via the extension host's existing WebSocket connection (postMessage bridge, not direct WebSocket from webview).
- **R7**: When a file is selected in the `changedFiles` tree, the webview updates to show that file's diff.
- **R8**: The webview uses unified diff mode only (sidebar width constraint, 200-400px typical).

### Non-Functional

- **NF1**: Webview bundle size under 500KB gzipped (React + diff lib + components).
- **NF2**: Diff rendering completes within 200ms for files under 1000 lines.
- **NF3**: CSS custom properties match the web UI's dark theme tokens exactly -- no visual drift.
- **NF4**: The webview must function in VS Code's Content Security Policy (nonce-based `<script>` and `<style>` tags). React inline `style` attributes are permitted — CSP restricts style _elements_, not the DOM `style` property.
- **NF5**: `retainContextWhenHidden: true` to preserve scroll position and thread state when the sidebar tab switches.

## Out of Scope

- **Split diff mode.** The sidebar is too narrow (200-400px). Unified only.
- **Text selection popover** (`DiffSelectionPopover`). Requires DOM selection APIs that interact poorly with VS Code webview CSP and the narrow viewport. The "+" button per line is sufficient for the prototype.
- **Line range selection** (`LineRangeSelector`, `SelectionComposePortal`). Same rationale as above -- defer to a later iteration.
- **DiffThreadNav** (thread navigation list). The sidebar's small viewport makes a dedicated nav panel impractical. Users navigate via the `changedFiles` tree instead.
- **Syntax highlighting in the diff.** `@git-diff-view/react` supports it but requires `highlight.js` or `shiki`, adding significant bundle size. Defer.
- **Spec review anchors.** This feature targets code review (diff-line anchors) only.
- **Replacing the native diff panel.** The existing `DiffPanelManager` and `vscode.diff` flow remain available. The webview is an additional view, not a replacement.

## User Flows

### UF1: Open Review Diff in Sidebar

1. User clicks the Local Review icon in the activity bar.
2. The sidebar opens showing the `changedFiles` tree (already exists) and the new webview diff panel below it.
3. User clicks a file in the tree.
4. The webview loads that file's unified diff with any existing review threads rendered inline.

### UF2: Add a Comment

1. User sees a "+" button on a diff line in the webview.
2. User clicks "+", a compose form appears inline (using `ComposeWidget` styling, adapted for webview).
3. User types a comment and submits (button or Cmd+Enter).
4. The webview sends the comment data via postMessage to the extension host.
5. The extension host calls `POST /api/sessions/:id/threads` on the server.
6. The server broadcasts the update via WebSocket.
7. The extension host receives the update and pushes new thread data to the webview via postMessage.

### UF3: Reply / Resolve a Thread

1. User sees an inline thread card in the webview diff.
2. User clicks "Reply" to expand the reply box, types a reply, and submits.
3. Alternatively, user clicks "Resolve" to close the thread.
4. Both actions follow the same postMessage -> extension host -> server API -> WebSocket -> postMessage round trip.

### UF4: Real-Time Sync

1. A collaborator (or the browser UI) creates a thread on a file the user is viewing.
2. The server broadcasts via WebSocket.
3. The extension host's `WsClient` receives the event.
4. The extension host pushes updated thread data to the webview via postMessage.
5. The webview re-renders with the new thread.
