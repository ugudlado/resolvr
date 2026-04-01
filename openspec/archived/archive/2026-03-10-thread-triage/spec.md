---
mode: non-tdd
feature-id: 2026-03-10-thread-triage
---

# Spec: Thread Triage & Smart Routing

## Overview

Add a severity/priority system to review threads that enables smart model routing in the resolver daemon and gives reviewers visual clarity on thread importance.

### Goals

- Replace `ThreadSeverity` values with triage-oriented levels: `critical`, `improvement`, `style`, `question`
- Display severity badges on thread cards in both inline diff view and side panels
- Route resolver model selection based on severity (`critical` -> Sonnet, others -> Haiku, `question` -> skip)
- Order thread resolution by priority (critical first, then improvement, then style)
- Allow reviewers to manually set/change severity via the ComposeBox selector

### Non-Goals

- AI auto-classification of severity (deferred to future iteration)
- Batch resolution of style threads (optimization deferred)
- Severity filtering in thread navigation panels

## Requirements

### R1: Severity Type Update

- Replace `ThreadSeverity` with `as const` object `THREAD_SEVERITY` in `types/constants.ts`
- Values: `critical`, `improvement`, `style`, `question`
- Default severity for new threads: `improvement`
- Acceptance: All existing references compile with updated type

### R2: Severity Badge Display

- ThreadCard header shows a severity badge with color-coded indicator
- Colors: critical = red/rose, improvement = blue, style = gray/muted, question = amber
- Badge shows both dot + label text (matches existing SeverityBadge pattern)
- Acceptance: Given a thread with severity "critical", the badge shows a red indicator with "critical" text

### R3: ComposeBox Severity Selector

- Update ComposeBox severity pills to use new values
- Default selection: `improvement`
- Style pills with appropriate colors matching badge colors
- Acceptance: Given the compose box is open, four severity pills are shown with correct labels and colors

### R4: Model Routing in Resolver

- `pickModel()` uses severity to select model:
  - `critical` -> `claude-sonnet-4-6`
  - `improvement` -> `claude-haiku-4-5-20251001`
  - `style` -> `claude-haiku-4-5-20251001`
  - `question` -> skip (do not resolve)
- If any thread is critical, use Sonnet for the whole batch
- Acceptance: Given 3 threads (1 critical, 2 style), `pickModel()` returns Sonnet

### R5: Priority Ordering in Resolver

- Before resolving, sort open threads by severity priority: critical > improvement > style
- Question threads are excluded from resolution
- The resolve prompt mentions thread priority ordering
- Acceptance: Given threads in random severity order, resolver processes critical ones first

### R6: Severity in Session Persistence

- `severity` field on ReviewThread is always populated (not optional)
- Existing sessions without severity default to `improvement` on load
- Server PATCH endpoint preserves severity field through thread updates
- Acceptance: Given a session file without severity fields, loading it populates `improvement` on all threads

### R7: Manual Override

- Reviewer can change severity after thread creation
- ThreadCard expanded view includes a severity dropdown/selector
- Changing severity persists to session immediately
- Acceptance: Given an open thread with severity "style", reviewer can change it to "critical" and the change persists

## Data Model

### ThreadSeverity (updated)

```typescript
export const THREAD_SEVERITY = {
  Critical: "critical",
  Improvement: "improvement",
  Style: "style",
  Question: "question",
} as const;

export type ThreadSeverity =
  (typeof THREAD_SEVERITY)[keyof typeof THREAD_SEVERITY];
```

### Priority Order

```typescript
const SEVERITY_PRIORITY: Record<ThreadSeverity, number> = {
  critical: 0, // highest priority
  improvement: 1,
  style: 2,
  question: 3, // lowest / skip
};
```

### ReviewThread.severity

- Type: `ThreadSeverity` (required, not optional)
- Default: `THREAD_SEVERITY.Improvement`

## Edge Cases

- **Legacy sessions**: Sessions saved before this feature won't have severity. On load, default missing severity to `improvement`.
- **All threads are questions**: If all open threads are questions, resolver should skip resolution entirely and return `{resolved: 0, clarifications: 0, fixes: []}`.
- **Mixed severity batch**: `pickModel()` escalates to the highest-capability model needed (any critical = Sonnet).
- **Server PATCH**: The `PatchPayload` should accept an optional `severity` field so external callers (async resolve scripts) can update severity.
