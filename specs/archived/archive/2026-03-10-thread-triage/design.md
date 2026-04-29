# Design: Thread Triage & Smart Routing

## Data Flow

```
Thread Creation (UI)
    |
    v
ComposeBox (severity selector: critical/improvement/style/question)
    |
    v
ReviewThread { severity: ThreadSeverity } -> session JSON file
    |
    v
Resolver Daemon reads session
    |
    +--> pickModel(threads) -> sonnet if any critical, else haiku
    |
    +--> sortByPriority(threads) -> critical first, question excluded
    |
    +--> buildResolvePrompt() -> includes priority info
    |
    v
Claude Agent SDK resolves threads in priority order
```

## Changes by File

### types/constants.ts

- Add `THREAD_SEVERITY` const object with `Critical`, `Improvement`, `Style`, `Question`
- Export `ThreadSeverity` type

### types/sessions.ts

- Remove inline `ThreadSeverity` type alias
- Import from constants
- Change `ReviewThread.severity` from optional to required

### components/shared/ComposeBox.tsx

- Update `SEVERITIES` array to use new values from `THREAD_SEVERITY`
- Update `severityStyles` map with new color scheme
- Change default severity from `"suggestion"` to `THREAD_SEVERITY.Improvement`

### components/shared/ThreadCard.tsx

- Update `severityConfig` map with new values and colors
- Add `SeveritySelector` sub-component for manual override in expanded view
- Wire `onSeverityChange` callback through `ThreadCardProps`

### apps/server/src/resolver-daemon.ts

- Update `pickModel()` to check for `"critical"` instead of `"blocking"`
- Add `sortByPriority()` to order threads before resolution
- Filter out `"question"` threads from resolution batch
- Update `buildResolvePrompt()` to mention priority ordering

### apps/server/src/routes/sessions.ts

- Add `severity` to `PatchPayload` interface
- Apply severity in PATCH handler

### pages/ReviewPage.tsx

- Pass severity through `handleComposeSubmit`
- Include severity in the thread object created

### pages/SpecReviewPage.tsx

- Pass severity through thread creation handler

### services/localReviewApi.ts

- Add optional `severity` field to the legacy `ReviewThread` type

### hooks/useReviewSession.ts

- No changes needed (threads pass through as-is)

## Error Handling

- Missing severity on legacy sessions: default to `"improvement"` in UI rendering (SeverityBadge already handles undefined gracefully)
- Invalid severity value in session file: treat as `"improvement"`

## Backward Compatibility

- The `severity` field on `ReviewThread` becomes required in the TypeScript type but the JSON files may lack it
- All rendering code must handle `undefined` severity gracefully (already does via optional chaining)
- The server PATCH endpoint is additive (new field in payload, no breaking changes)
