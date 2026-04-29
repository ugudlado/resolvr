# Design: VS Code Webview Diff Panel

## Architecture Overview

```
+----------------------------------+       +-------------------+
| VS Code Extension Host (Node.js) |       | local-review      |
|                                  |       | server (:37003)   |
|  extension.ts                    |  REST |                   |
|    DiffPanelManager (existing)   | ----> | GET /api/diff     |
|    DiffWebviewProvider (new)     |  WS   | GET /api/sessions |
|    WsClient (existing)           | <---> | POST threads/msgs |
|                                  |       +-------------------+
+--------+-----------+-------------+
         |           |
    postMessage   postMessage
         |           |
+--------v-----------v-------------+
| Webview (React app)              |
|                                  |
|  DiffViewWrapper                 |
|  DiffInlineThread                |
|  ComposeWidget (simplified)      |
|  WebviewBridge (postMessage API) |
+----------------------------------+
```

Two build outputs from the `apps/vscode` package:

1. `dist/extension.js` -- Node.js CJS bundle (existing, extended with `DiffWebviewProvider`)
2. `dist/webview.js` + `dist/webview.css` -- Browser bundle (new, React app for the webview)

## Component Design

### New Modules

#### 1. `DiffWebviewProvider` (extension host side)

**File**: `apps/vscode/src/diffWebviewProvider.ts`

Implements `vscode.WebviewViewProvider`. Responsibilities:

- Generates the HTML shell with CSP-compliant nonce-based script/style tags
- Loads `dist/webview.js` and `dist/webview.css` as webview-local resources
- Handles incoming postMessage from the webview (comment creation, reply, resolve)
- Pushes data to the webview (diff content, thread updates, file changes)
- Proxies all API calls through the extension host's `serverClient` (the webview cannot make HTTP requests to localhost)

```typescript
interface WebviewMessage {
  type:
    | "ready"
    | "createThread"
    | "replyThread"
    | "resolveThread"
    | "unresolveThread";
  payload: unknown;
}

interface ExtensionMessage {
  type: "setDiff" | "setThreads" | "setFile" | "threadCreated" | "error";
  payload: unknown;
}
```

#### 2. `WebviewBridge` (webview side)

**File**: `apps/vscode/src/webview/bridge.ts`

Thin wrapper around `window.acquireVsCodeApi()` that:

- Exposes typed `send(type, payload)` and `onMessage(handler)` methods
- Handles the `ready` handshake (webview tells extension host it's mounted)
- Provides React-friendly hooks: `useBridge()` returns the bridge instance

#### 3. `WebviewApp` (webview side)

**File**: `apps/vscode/src/webview/App.tsx`

Root React component. Renders:

- `DiffViewWrapper` in unified mode with `enableComments={true}`
- `DiffInlineThread` for each thread at its anchored line (via `renderThreads` / `extendData`)
- A simplified compose form for new comments (inline, no portal needed)
- Empty state when no file is selected

State management: `useReducer` with actions dispatched by the bridge's `onMessage` handler. No Zustand, no router -- this is a single-view app.

#### 4. Simplified `ComposeWidget` (webview side)

**File**: `apps/vscode/src/webview/ComposeInline.tsx`

A stripped-down compose form that does NOT depend on shadcn `Button`/`Textarea` or the web UI's `ComposeBox`. Plain HTML elements styled with the theme's CSS custom properties. This avoids pulling in the entire shadcn component tree.

[ASSUMPTION] The web UI's `ComposeBox` imports shadcn components (`Button`, `Textarea`) and their transitive dependencies. Bundling those into the webview would bloat the bundle and introduce Tailwind v4 build complexity. A simplified compose form with equivalent UX (textarea, submit button, Cmd+Enter, Esc to cancel) is the pragmatic choice.

### Existing Modules Modified

#### `extension.ts`

- Instantiate `DiffWebviewProvider` and register it with `vscode.window.registerWebviewViewProvider`
- Wire `WsClient` session-updated events to push thread data to the webview provider

#### `package.json` (contributes)

- Add a new `view` entry under the `local-review` viewsContainer for the webview panel
- Add `build:webview` script to the scripts section

#### `DiffPanelManager`

Minor change: when a file is opened via `openFile()`, it also notifies `DiffWebviewProvider.showFile(file)` so the webview updates in sync. The existing native diff behavior (`vscode.diff`) remains — both views update on file selection.

#### `extension.ts` (file selection wiring)

The `local-review.openDiffFile` command handler currently only calls `diffPanelManager.openFile(...)`. It must also call `diffWebviewProvider.showFile(file)` so the webview renders the selected file's diff. This is the integration seam — the tree's `command` property triggers this handler.

## Build Pipeline

### Current

```
esbuild src/extension.ts → dist/extension.js (CJS, Node.js, external: vscode)
```

### Proposed

```
# Extension host bundle (unchanged target, add new provider import)
esbuild src/extension.ts → dist/extension.js (CJS, Node.js, external: vscode)

# Webview bundle (NEW)
esbuild src/webview/index.tsx → dist/webview.js (ESM, browser)
  + CSS output → dist/webview.css (via esbuild CSS bundling)
```

The webview bundle:

- **Platform**: `browser` (not node)
- **Format**: `iife` (single file, no module loader needed in webview)
- **External**: nothing -- all deps bundled (React, @git-diff-view/react, react-markdown, remark-gfm)
- **CSS**: esbuild handles `import "@git-diff-view/react/styles/diff-view-pure.css"` and inlines it into `dist/webview.css`
- **JSX**: automatic runtime (React 18)

The `build` script in `package.json` becomes two esbuild invocations (sequential or parallel, both fast).

### New Dependencies

Added to `apps/vscode/package.json`:

```json
{
  "dependencies": {
    "ws": "^8.19.0"
  },
  "devDependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@git-diff-view/react": "^0.0.40",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

[ASSUMPTION] React and related deps are devDependencies because they are bundled into `dist/webview.js` at build time. The VSIX package only ships the bundled output.

## CSS / Styling Strategy

### DD1: Pre-compiled CSS with injected custom properties

**Decision**: Do NOT use Tailwind in the webview build. Instead:

1. Extract the CSS custom properties (`:root` block) from `apps/ui/src/index.css` into a standalone `apps/vscode/src/webview/theme.css` file.
2. The diff components (`DiffViewWrapper`, `DiffInlineThread`) already use `style={{ color: "var(--text-primary)" }}` for most styling -- they work with raw CSS variables, not Tailwind utilities.
3. For the small number of Tailwind utility classes used in these components (e.g., `className="flex items-center gap-2"`), write equivalent plain CSS in a `webview.css` file.
4. Import `@git-diff-view/react/styles/diff-view-pure.css` directly.
5. Import the `.prose-review` and `.diff-line-extend-wrapper` overrides from the web UI's `index.css` (copy the relevant blocks).

**Rejected alternatives**:

- _Bundle Tailwind v4 in the webview_: Adds build complexity (PostCSS pipeline), increases CSS output size, and Tailwind's JIT scanner would need to scan the webview source separately. Overkill for ~4 components.
- _Use VS Code's built-in CSS variables_ (`--vscode-editor-background`, etc.): Would make the webview match VS Code's theme but diverge from the web UI. The goal is visual consistency with the browser review app, not with the VS Code color theme.

### DD2: Fork diff components rather than share source files

**Decision**: Copy `DiffViewWrapper` and `DiffInlineThread` into `apps/vscode/src/webview/components/` and adapt them:

- Remove Tailwind utility classes, replace with plain CSS classes
- Remove shadcn component imports (ComposeBox uses `Button`, `Textarea`)
- Remove `lucide-react` icon imports (replace with inline SVG or Unicode)
- Keep the `@git-diff-view/react` DiffView integration identical
- Keep the `style={{ ... }}` inline styles using CSS custom properties (these work as-is)

**Rejected alternatives**:

- _Import directly from `apps/ui/src/components/diff/`_: These files import Tailwind utilities, shadcn components, lucide icons, and use path aliases (`@/components/ui/`). The webview's esbuild config would need to resolve all of these, pulling in the entire web UI dependency tree. The coupling would make both packages fragile.
- _Create a shared `packages/diff-components` workspace_: Architecturally clean but over-engineered for a rapid prototype with 2-3 components. The components will likely diverge (narrow viewport optimizations, webview-specific interaction patterns) making shared code a liability.

### DD3: Unified diff mode only

**Decision**: The webview always renders in unified mode (`DiffModeEnum.Unified`).

**Rationale**: At 200-400px sidebar width, split mode is unusable. Even if the user drags the sidebar wider, unified mode provides a better reading experience for code review where the focus is on understanding changes, not comparing side-by-side.

**Rejected alternatives**:

- _Auto-switch based on width_: Adds complexity and the split mode at sidebar width would still be too narrow. Defer until there is user demand.

### DD4: postMessage bridge (not direct HTTP/WS from webview)

**Decision**: The webview communicates exclusively with the extension host via `postMessage`. The extension host proxies all server API calls and WebSocket events.

**Rationale**:

- Webview origin is `vscode-webview://` -- `localhost` fetch would require CSP relaxation
- WebSocket connections from the webview would duplicate the extension host's existing `WsClient`
- The extension host already has `serverClient` with typed methods and error handling
- Single connection point simplifies debugging and avoids race conditions

**Rejected alternatives**:

- _Direct fetch from webview with CSP frame-src_: Possible but fragile. CSP policies differ across VS Code versions, and remote development (SSH, Codespaces) breaks localhost assumptions.

### DD5: WebviewView in the sidebar (not WebviewPanel in editor area)

**Decision**: Use `WebviewViewProvider` registered to the existing `local-review` sidebar container. The diff view appears below the `changedFiles` tree.

**Rationale**: The sidebar groups all review-related views (file tree + diff + threads) in one place. The user keeps their editor area free for actual code editing. The `changedFiles` tree acts as the file navigator for the diff webview.

**Rejected alternatives**:

- _WebviewPanel in editor area_: More space (full editor width) but competes with source files the user is editing. Also loses the tight coupling with the `changedFiles` tree.
- _Secondary sidebar (right panel)_: VS Code supports this but it requires explicit user setup and is less discoverable. Could be added later as an option.

[ASSUMPTION] The sidebar width (200-400px) is sufficient for unified diff viewing with the current font size (13px). If users report readability issues, a future iteration could offer a "pop out to editor" command.

## Communication Protocol

### Webview -> Extension Host

```typescript
// Webview sends:
{ type: 'ready' }
// Extension host responds with current file + threads

{ type: 'createThread', payload: { anchor: DiffLineAnchor, text: string } }
// Extension host calls POST /api/sessions/:id/threads

{ type: 'replyThread', payload: { threadId: string, text: string } }
// Extension host calls POST /api/sessions/:id/threads/:threadId/messages

{ type: 'resolveThread', payload: { threadId: string } }
// Extension host calls PATCH /api/sessions/:id/threads/:threadId

{ type: 'unresolveThread', payload: { threadId: string } }
// Extension host calls PATCH /api/sessions/:id/threads/:threadId
```

### Extension Host -> Webview

```typescript
{ type: 'setFile', payload: { fileName: string, hunks: string[], oldContent?: string, newContent?: string } }
// Sent when user selects a file in the changedFiles tree

{ type: 'setThreads', payload: { threads: ReviewThread[] } }
// Sent on initial load and on every WS session-updated event

{ type: 'error', payload: { message: string } }
// Sent when an API call fails
```

## Data Flow

```
File Selection Flow:
  changedFiles tree click
    -> DiffPanelManager.openFile() [existing, opens native diff]
    -> DiffWebviewProvider.showFile(file)
        -> serverClient.getDiff() to get raw diff
        -> parse hunks for the selected file
        -> postMessage({ type: 'setFile', payload: { fileName, hunks } })
        -> webview re-renders DiffViewWrapper with new data

Thread Creation Flow:
  User clicks "+" in webview diff
    -> React renders ComposeInline at that line
    -> User types and submits
    -> postMessage({ type: 'createThread', payload: { anchor, text } })
    -> DiffWebviewProvider receives message
    -> serverClient.createThread(featureId, anchor, text)
    -> Server responds with created thread
    -> postMessage({ type: 'threadCreated', payload: thread })
    -> Webview adds thread to state, DiffInlineThread renders

Real-Time Sync Flow (single source of truth):
  Server broadcasts session-updated via WS
    -> WsClient receives event
    -> extension.ts handler calls:
        - commentManager.loadThreads() [existing]
        - diffWebviewProvider.updateThreads(threads) [new]
    -> diffWebviewProvider sends postMessage({ type: 'setThreads', payload })
    -> Webview replaces thread state, re-renders all DiffInlineThreads

  NOTE: Thread creation does NOT send a separate threadCreated message.
  The webview shows an optimistic local placeholder until the next
  WS-driven setThreads replaces state. This avoids double-delivery
  races between mutation responses and WS broadcasts.
```

## Package.json Changes

### `contributes.views`

Add a second view to the `local-review` container:

```json
{
  "views": {
    "local-review": [
      {
        "id": "localReview.changedFiles",
        "name": "Changed Files",
        "when": "local-review.hasDiffPanel"
      },
      {
        "id": "localReview.diffView",
        "type": "webview",
        "name": "Diff",
        "when": "local-review.hasDiffPanel"
      }
    ]
  }
}
```

### `scripts`

```json
{
  "build": "node build.mjs",
  "build:ext": "esbuild src/extension.ts --bundle --platform=node --format=cjs --outfile=dist/extension.js --external:vscode",
  "build:webview": "esbuild src/webview/index.tsx --bundle --platform=browser --format=iife --outfile=dist/webview.js --loader:.css=css",
  "watch": "node build.mjs --watch"
}
```

A `build.mjs` script runs both esbuild invocations (extension + webview) with shared config. The existing single `build` command continues to work.

## File Structure (new files)

```
apps/vscode/
  src/
    diffWebviewProvider.ts      # WebviewViewProvider implementation
    webview/
      index.tsx                 # Entry point: ReactDOM.createRoot, bridge setup
      App.tsx                   # Root component: DiffViewWrapper + state
      bridge.ts                 # postMessage typed wrapper
      ComposeInline.tsx         # Simplified compose form (no shadcn deps)
      components/
        DiffViewWrapper.tsx     # Forked from apps/ui, Tailwind removed
        DiffInlineThread.tsx    # Forked from apps/ui, Tailwind removed
      styles/
        theme.css               # CSS custom properties from web UI
        webview.css             # Replacement styles for Tailwind utilities
  build.mjs                     # Unified build script for both bundles
  dist/
    extension.js                # Existing (updated)
    webview.js                  # New
    webview.css                 # New
```
