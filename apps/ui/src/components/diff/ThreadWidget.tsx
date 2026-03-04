/**
 * ThreadWidget — Inline components for rendering review threads and compose
 * forms inside @git-diff-view widget/extend slots.
 *
 * - ComposeWidget: shown when user clicks "+" to add a new comment on a line.
 * - ThreadDisplay: persistent display for lines that already have threads.
 */

import { useCallback } from "react";
import { ComposeBox } from "../shared/ComposeBox";
import { ThreadCard } from "../shared/ThreadCard";
import type {
  DiffLineAnchor,
  ReviewThread,
  ThreadSeverity,
} from "../../types/sessions";

// ---------------------------------------------------------------------------
// ComposeWidget
// ---------------------------------------------------------------------------

export interface ComposeWidgetProps {
  lineNumber: number;
  /** Start line for multiline selections. Defaults to lineNumber. */
  startLineNumber?: number;
  side: "old" | "new";
  filePath: string;
  onSubmit: (
    anchor: DiffLineAnchor,
    text: string,
    severity?: ThreadSeverity,
  ) => void;
  onClose: () => void;
  /** Quoted text from text selection to show in compose box. */
  quotedText?: string;
}

/**
 * Inline compose form rendered inside DiffView's widget slot.
 * Creates a DiffLineAnchor from the line context and delegates to ComposeBox.
 */
export function ComposeWidget({
  lineNumber,
  startLineNumber,
  side,
  filePath,
  onSubmit,
  onClose,
  quotedText,
}: ComposeWidgetProps) {
  const handleSubmit = useCallback(
    (text: string, severity?: ThreadSeverity) => {
      const startLine = startLineNumber ?? lineNumber;
      const isRange = startLine !== lineNumber;
      const anchor: DiffLineAnchor = {
        type: "diff-line",
        hash: "", // populated by the session layer on persist
        path: filePath,
        preview: isRange
          ? `Lines ${startLine}–${lineNumber} (${side})`
          : `Line ${lineNumber} (${side})`,
        line: startLine,
        lineEnd: isRange ? lineNumber : undefined,
        side,
      };
      onSubmit(anchor, text, severity);
    },
    [lineNumber, startLineNumber, side, filePath, onSubmit],
  );

  return (
    <div className="border-l-2 border-[var(--accent-blue)] bg-[var(--bg-surface)] p-2">
      <ComposeBox
        onSubmit={handleSubmit}
        onCancel={onClose}
        placeholder="Add a review comment..."
        autoFocus
        compact
        quotedText={quotedText}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadDisplay
// ---------------------------------------------------------------------------

export interface ThreadDisplayProps {
  threads: ReviewThread[];
  onReply: (threadId: string, text: string) => void;
  onStatusChange: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
}

/**
 * Persistent inline display of review threads at a diff line.
 * Renders each thread as a compact ThreadCard within the extend slot.
 */
export function ThreadDisplay({
  threads,
  onReply,
  onStatusChange,
}: ThreadDisplayProps) {
  if (threads.length === 0) return null;

  return (
    <div className="space-y-1.5 border-l-2 border-amber-500/60 bg-[var(--bg-surface)] p-2">
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          onReply={onReply}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
