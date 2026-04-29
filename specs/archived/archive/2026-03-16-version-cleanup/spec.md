# Spec: Plugin Cache Version Cleanup

## Motivation

The local-review plugin accumulates old cached versions in `~/.claude/plugins/cache/ugudlado/local-review/` over time. Each version is a full git clone (~4-5 MB). Currently there are three versions on disk (1.0.0, 1.1.0, 1.2.0) totaling ~13 MB, but only 1.2.0 is referenced by `installed_plugins.json`. The older versions are orphaned -- they will never be used again.

Beyond disk waste, orphaned cached versions create a risk: if the `find` fallback in `session-start.sh` picks up a stale version's `index.js` before the current one, the wrong version could start. This is unlikely with `head -1` and lexicographic ordering, but the risk grows as versions accumulate.

No cleanup mechanism exists in any Claude Code plugin today. This feature adds one to local-review's SessionStart hook.

## Requirements

### Functional

1. **R-1**: On session start, detect all cached version directories under `~/.claude/plugins/cache/ugudlado/local-review/`.
2. **R-2**: Identify the currently-active version from `installed_plugins.json` (the last entry in the `local-review@ugudlado` array).
3. **R-3**: Remove all cached version directories that are not the currently-active version.
4. **R-4**: Log cleaned versions and bytes freed to `/tmp/local-review-cleanup.log`.
5. **R-5**: Skip cleanup entirely when running from the live dev repo (`~/code/review`).

### Non-Functional

1. **NF-1**: Cleanup must complete in under 2 seconds and not block session startup (run async).
2. **NF-2**: Cleanup must be safe -- never delete the active version, never error out and break the session hook.
3. **NF-3**: No modifications to `installed_plugins.json` -- that file is owned by Claude Code itself.

### Non-Goals

- Do not clean up other plugins' caches (each plugin should own its own cleanup).
- Do not deduplicate entries within `installed_plugins.json` (that is a Claude Code platform concern).
- Do not change the version detection or server startup logic in `session-start.sh` beyond adding the cleanup call.

## Acceptance Criteria

1. After a session start, only the currently-active cached version remains on disk.
2. If no stale versions exist, the hook completes silently with no errors.
3. If running from the live dev repo, no cleanup is attempted.
4. Cleanup failures (permission errors, missing directories) are caught and logged but do not break the session hook.
5. `/tmp/local-review-cleanup.log` contains a timestamped record of any cleanup actions taken.
