/**
 * Shared `as const` objects for all domain string literals used across
 * the codebase. Importing from here (rather than scattering literals)
 * enables autocomplete, prevents typos, and makes refactoring safe.
 */

// ---------------------------------------------------------------------------
// Feature source type
// ---------------------------------------------------------------------------

export const SOURCE_TYPE = {
  Worktree: "worktree",
  Branch: "branch",
} as const;

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE];

// ---------------------------------------------------------------------------
// Feature lifecycle status
// ---------------------------------------------------------------------------

export const FEATURE_STATUS = {
  New: "new",
  Design: "design",
  DesignReview: "design_review",
  Code: "code",
  CodeReview: "code_review",
  Complete: "complete",
} as const;

export type FeatureStatus =
  (typeof FEATURE_STATUS)[keyof typeof FEATURE_STATUS];

// ---------------------------------------------------------------------------
// Review verdict
// ---------------------------------------------------------------------------

export const REVIEW_VERDICT = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
} as const;

export type ReviewVerdict =
  | (typeof REVIEW_VERDICT)[keyof typeof REVIEW_VERDICT]
  | null;

// ---------------------------------------------------------------------------
// Feature tab names (route segments)
// ---------------------------------------------------------------------------

export const FEATURE_TAB = {
  Code: "code",
  Spec: "spec",
  Tasks: "tasks",
} as const;

export type FeatureTab = (typeof FEATURE_TAB)[keyof typeof FEATURE_TAB];

// ---------------------------------------------------------------------------
// Review thread status
// ---------------------------------------------------------------------------

export const THREAD_STATUS = {
  Open: "open",
  Resolved: "resolved",
  Approved: "approved",
} as const;

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];

// ---------------------------------------------------------------------------
// Review thread severity (triage levels for smart routing)
// ---------------------------------------------------------------------------

export const THREAD_SEVERITY = {
  Critical: "critical",
  Improvement: "improvement",
  Style: "style",
  Question: "question",
} as const;

export type ThreadSeverity =
  (typeof THREAD_SEVERITY)[keyof typeof THREAD_SEVERITY];
