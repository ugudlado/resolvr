# Design: Plugin Cache Version Cleanup

## Approach

Add a standalone shell script `hooks/cleanup-cache.sh` that handles version cleanup, called from the existing `session-start.sh`. The cleanup logic is separated into its own script for clarity and testability.

### Why a separate script?

`session-start.sh` already has two concerns: starting the server and cold-starting the resolver. Adding cleanup inline would make it harder to read. A separate script also makes it easy to run manually for debugging.

## Component Breakdown

### 1. `hooks/cleanup-cache.sh` (new)

The core cleanup script. Logic:

```
1. Define CACHE_DIR=~/.claude/plugins/cache/ugudlado/local-review
2. If CACHE_DIR does not exist or has fewer than 2 subdirectories, exit early
3. Read installed_plugins.json, extract the installPath of the last entry for "local-review@ugudlado"
4. Extract the version directory name from that path (e.g., "1.2.0")
5. For each subdirectory in CACHE_DIR that is NOT the active version:
   a. Log the directory being removed (with du -s size)
   b. rm -rf the directory
6. Log summary (versions removed, total bytes freed, timestamp)
```

**JSON parsing**: Use Python (always available on macOS) for reliable JSON extraction rather than fragile jq/grep:

```bash
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
entries = data.get('plugins', {}).get('local-review@ugudlado', [])
if entries:
    print(entries[-1]['installPath'].rstrip('/').split('/')[-1])
" ~/.claude/plugins/installed_plugins.json
```

[ASSUMPTION] Python3 is always available. This is safe on macOS where it ships with Xcode CLI tools.

### 2. `hooks/session-start.sh` (modified)

Add a single line near the top (after the PORT/SERVER_ALREADY_RUNNING variables, before the server startup logic) to invoke cleanup in the background:

```bash
# Clean up old cached versions (non-blocking)
"${BASH_SOURCE%/*}/cleanup-cache.sh" >>/tmp/local-review-cleanup.log 2>&1 &
```

This runs cleanup fully asynchronously -- it cannot delay session startup regardless of how long it takes.

### 3. `hooks/hooks.json` (unchanged)

No changes needed. The cleanup is invoked by `session-start.sh`, not as a separate hook entry.

## Safety Mechanisms

1. **Never delete active version**: The script explicitly identifies the active version from `installed_plugins.json` and skips it. If the active version cannot be determined (JSON parse failure, missing file), the script exits without deleting anything.

2. **Early exit on no work**: If there are fewer than 2 directories, there is nothing to clean up.

3. **Error trapping**: The cleanup script uses `set -euo pipefail` but wraps `rm -rf` in a conditional so individual deletion failures don't abort the whole script. All errors are captured in the log file.

4. **Dev repo detection**: Not needed in `cleanup-cache.sh` itself -- the script only touches the cache directory regardless of whether the dev repo is in use. The cache should still be cleaned even when developing locally, since those cached versions are genuinely unused.

## Version Comparison Strategy

No version comparison or ordering is needed. The approach is simpler: read the active version from `installed_plugins.json` (the source of truth) and delete everything else. This works regardless of whether versions use semver (1.2.0) or commit hashes (d5c15b861cd2).

## Data Flow

```
SessionStart hook
  -> session-start.sh
     -> cleanup-cache.sh (background, non-blocking)
        -> reads ~/.claude/plugins/installed_plugins.json
        -> identifies active version directory name
        -> removes all other directories under cache/ugudlado/local-review/
        -> appends log to /tmp/local-review-cleanup.log
     -> (continues with server startup as before)
```

## Error Handling

| Scenario                         | Behavior                                       |
| -------------------------------- | ---------------------------------------------- |
| `installed_plugins.json` missing | Exit 0, log warning                            |
| No `local-review@ugudlado` entry | Exit 0, log warning                            |
| Cache directory missing          | Exit 0, no action                              |
| `rm -rf` fails on a directory    | Log error, continue with remaining directories |
| Python3 not available            | Exit 0, log warning                            |

## Alternatives Considered

1. **Inline in session-start.sh**: Rejected -- makes the already-busy script harder to read.
2. **Node.js script**: Rejected -- heavier than necessary for a simple file cleanup task. Shell is the right tool.
3. **Cleanup as separate hooks.json entry**: Rejected -- adds another hook invocation and `CLAUDE_PLUGIN_ROOT` resolution when we can just call the script directly from `session-start.sh`.
4. **Clean up installed_plugins.json too**: Rejected as a non-goal -- that file is owned by Claude Code, modifying it could cause issues.
