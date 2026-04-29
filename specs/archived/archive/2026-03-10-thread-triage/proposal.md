# Proposal: Thread Triage & Smart Routing

## Motivation

The resolver daemon's `pickModel()` function already checks thread severity to decide whether to use Sonnet or Haiku, but threads never have a severity field populated. This means every resolve cycle defaults to Haiku regardless of thread importance, and there is no way for reviewers to understand thread priority at a glance.

Adding a severity classification system enables:

1. **Cost optimization** -- route simple style/naming threads to Haiku, reserve Sonnet for critical issues
2. **Priority ordering** -- resolve blocking issues first so the developer gets the most impactful fixes earliest
3. **Visual clarity** -- reviewers instantly see which threads need urgent attention via severity badges
4. **Skip logic** -- "question" threads that need human clarification skip automated resolution entirely

## Approach

Extend the existing `ThreadSeverity` type from its current values (`blocking`, `suggestion`, `nitpick`) to a new triage-oriented set (`critical`, `improvement`, `style`, `question`). Update the ComposeBox severity selector, ThreadCard badge, resolver-daemon routing, and resolve prompt ordering to use these new values.

## Alternatives Considered

1. **Keep existing severity values and add routing logic** -- The current values (`blocking`, `suggestion`, `nitpick`) don't cleanly map to model routing decisions. `nitpick` conflates style issues with low-priority improvements. A purpose-built set is cleaner.

2. **AI auto-classification at thread creation** -- Considered having the UI call an API to classify severity from thread text. Rejected for v1 because it adds latency to comment creation and requires an API key on the client. Instead, default to `improvement` and let the reviewer adjust.

3. **Server-side classification** -- Classify on save rather than in the UI. Rejected because it would require the server to have AI access and adds complexity.

## Decision

Replace `ThreadSeverity` values with `critical | improvement | style | question`. Default new threads to `improvement`. Let reviewers manually override via the existing severity selector in ComposeBox. Update `pickModel()` to route based on the new values and sort threads by priority before resolving.
