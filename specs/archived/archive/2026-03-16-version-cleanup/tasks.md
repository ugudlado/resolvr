# Tasks: 2026-03-16-version-cleanup

## [x] Phase 1: Cache Cleanup Implementation

### [x] T-1: Create cleanup-cache.sh script

**Why**: Core requirement -- implements R-1 through R-5 (detect stale versions, identify active version, remove stale, log results).
**Files**: `hooks/cleanup-cache.sh` (new)
**Verify**:

- Script is executable (`chmod +x`)
- Running it manually with 3 cached versions (1.0.0, 1.1.0, 1.2.0) removes 1.0.0 and 1.1.0
- Running it when only the active version exists produces no errors and no deletions
- Running it when `installed_plugins.json` is missing exits cleanly with a warning in the log
- `/tmp/local-review-cleanup.log` contains timestamped entries

---

### [x] T-2: Integrate cleanup into session-start.sh

**Why**: Cleanup must run automatically on every session start (R-1, NF-1) without blocking server startup.
**Files**: `hooks/session-start.sh` (modify)
**Verify**:

- Cleanup runs in the background (appended `&`)
- Session startup time is not measurably affected
- Server still starts correctly after the change
- Log file at `/tmp/local-review-cleanup.log` is populated after a session start

---

### [x] T-3: Rebuild server dist bundle

**Why**: The plugin ships via committed dist bundles. While hooks are not bundled (they run from source), a dist rebuild ensures consistency and the version bump is captured.
**Files**: `apps/server/dist/index.js` (rebuild via `pnpm -C apps/server build`)
**Verify**:

- `pnpm -C apps/server build` succeeds
- No unrelated changes in the dist output

---
