# Tasks — VS Code Serverless Extension

## Phase 1: File-Based Module Creation + Extension Rewire

### T-1: Create sessionStore, sessionWatcher, gitDiff modules

- [x] Create `sessionStore.ts` — file-based session I/O with atomic writes, mirrors serverClient API
- [x] Create `sessionWatcher.ts` — FileSystemWatcher with timestamp-based self-write suppression
- [x] Create `gitDiff.ts` — local git diff via execFile, returns same shape as server API

### T-2: Rewire extension to use file-based modules, delete server deps

- [x] Swap all serverClient/wsClient imports for sessionStore/sessionWatcher/gitDiff
- [x] Remove \_pendingSkips echo suppression from commentManager
- [x] Simplify statusBar (remove disconnected state, rename connected→ready)
- [x] Rewrite extension.ts init flow (file-based, no connection check)
- [x] Update requestChanges to write verdict + show notification
- [x] Remove ws dependency, @types/ws, connect/disconnect commands, serverUrl config
- [x] Delete serverClient.ts and wsClient.ts
- [x] Type-check passes, build succeeds, zero serverClient/wsClient imports remain
