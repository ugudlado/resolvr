/**
 * Shared TypeScript types for spec review and code review sessions.
 *
 * Both session types share a unified ReviewThread model with polymorphic
 * ThreadAnchor to support spec paragraph anchoring and diff-line anchoring.
 */

// Import constants so they can be used within this file, and re-export them
// so consumers can import from either "types/sessions" or "types/constants".
import {
  FEATURE_STATUS,
  type FeatureStatus,
  REVIEW_VERDICT,
  type ReviewVerdict,
  THREAD_STATUS,
  type ThreadStatus,
  THREAD_SEVERITY,
  type ThreadSeverity,
} from "./constants";

export {
  FEATURE_STATUS,
  type FeatureStatus,
  REVIEW_VERDICT,
  type ReviewVerdict,
  THREAD_STATUS,
  type ThreadStatus,
  THREAD_SEVERITY,
  type ThreadSeverity,
};

// ---------------------------------------------------------------------------
// Thread anchor — polymorphic union
// ---------------------------------------------------------------------------

/**
 * Anchor for a spec block (paragraph, heading, diagram, list-item).
 * Stored by the specAnchoring pre-pass: content hash for exact match,
 * section path for fallback fuzzy matching, and blockIndex for ordering.
 */
export type SpecBlockAnchor = {
  type: "paragraph" | "heading" | "diagram" | "list-item";
  /** First 8 chars of SHA-256 of the block's text content. */
  hash: string;
  /** Section path built from heading context, e.g. "Architecture.Components". */
  path: string;
  /** First 80 chars of text content for display purposes. */
  preview: string;
  /** Sequential position in the document (for ordering within a section). */
  blockIndex: number;
  /** Selected text within the block (for text-selection comments). */
  selectedText?: string;
  /** If the selection spans multiple blocks, the ending block index. */
  blockIndexEnd?: number;
};

/**
 * Anchor for a diff line in a code review.
 * `line` and `lineEnd` define the highlighted range; the widget renders at `lineEnd`.
 */
export type DiffLineAnchor = {
  type: "diff-line";
  /** First 8 chars of SHA-256 of the anchor line's text content. */
  hash: string;
  /** File path relative to the repo root. */
  path: string;
  /** First 80 chars of the anchor line for display purposes. */
  preview: string;
  /** Start line number (1-based) of the comment range. */
  line: number;
  /** End line number (1-based) of the comment range. Equals `line` for single-line comments. */
  lineEnd?: number;
  /** Which side of the diff the comment is anchored to. */
  side: "old" | "new";
};

export type ThreadAnchor = SpecBlockAnchor | DiffLineAnchor;

// ---------------------------------------------------------------------------
// Unified feature status
// ---------------------------------------------------------------------------

/**
 * Single linear status for a feature's lifecycle.
 *
 * State machine:
 *   new → design           (spec file created)
 *   design → design_review (spec review session created)
 *   design_review → design (spec changes requested)
 *   design_review → code   (spec approved)
 *   code → code_review     (code review session created)
 *   code_review → code     (code changes requested)
 *   code_review → complete (code approved)
 */

// ---------------------------------------------------------------------------
// Review messages
// ---------------------------------------------------------------------------

export const AuthorType = {
  Human: "human",
  Agent: "agent",
} as const;
export type AuthorType = (typeof AuthorType)[keyof typeof AuthorType];

export interface ReviewMessage {
  id: string;
  /** Whether the message was written by a human reviewer or an AI agent. */
  authorType: AuthorType;
  /** Display name of the author (e.g. "reviewer", "claude"). */
  author: string;
  text: string;
  createdAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Review thread (shared between spec and code sessions)
// ---------------------------------------------------------------------------

export type ThreadFilter = "open" | "resolved";

export interface ReviewThread {
  id: string;
  anchor: ThreadAnchor;
  status: ThreadStatus;
  severity: ThreadSeverity;
  messages: ReviewMessage[];
  lastUpdatedAt: string; // ISO 8601
  /** Model used to resolve this thread (for analytics). */
  resolvedByModel?: string;
  /** Thread severity at time of resolution (for analytics). */
  resolvedWithSeverity?: ThreadSeverity;
  /** Arbitrary labels for analytics and filtering (e.g. { "model": "sonnet", "effort": "high" }). */
  labels?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Task progress (parsed from tasks.md)
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "in_progress" | "done" | "skipped";

export interface Task {
  /** Task identifier, e.g. "T001". */
  id: string;
  description: string;
  status: TaskStatus;
  /** IDs of tasks this task depends on, e.g. ["T001", "T002"]. */
  dependencies: string[];
  /** Whether this task can run in parallel with its siblings. */
  parallelizable: boolean;
  /** Which spec requirement this task satisfies (from **Why** line). */
  why?: string;
  /** Files this task creates or modifies (from **Files** line). */
  files?: string;
  /** Concrete completion criteria (from **Done when** line). */
  doneWhen?: string;
}

export interface Phase {
  name: string;
  tasks: Task[];
  /** Completion percentage for this phase, 0–100. */
  progress: number;
}

export interface TaskProgress {
  /** Feature ID parsed from `# Tasks: FEATURE_ID` heading. */
  featureId: string;
  /** Development mode parsed from `## Development Mode: TDD|Non-TDD` heading. */
  developmentMode: "TDD" | "Non-TDD";
  total: number;
  completed: number;
  inProgress: number;
  phases: Phase[];
  /** Overall completion percentage across all phases, 0–100. */
  overallProgress: number;
}

// ---------------------------------------------------------------------------
// Spec review session
// ---------------------------------------------------------------------------

export interface SpecReviewSession {
  featureId: string;
  worktreePath: string;
  /** Relative path to the spec file, e.g. "specs/active/spec.md". */
  specPath: string;
  verdict: ReviewVerdict;
  threads: ReviewThread[];
  taskProgress: TaskProgress;
  metadata: {
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  };
}

// ---------------------------------------------------------------------------
// Code review session
// ---------------------------------------------------------------------------

export interface CodeReviewSession {
  featureId: string;
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  verdict: ReviewVerdict;
  reviewVerdict?: ReviewVerdict;
  threads: ReviewThread[];
  committedDiff?: string;
  uncommittedDiff?: string;
  /** Combined diff used as the canonical diff for display. */
  allDiff?: string;
  metadata: {
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  };
}
