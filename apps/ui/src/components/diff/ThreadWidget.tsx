/**
 * ThreadWidget — Inline components for rendering review threads and compose
 * forms inside @git-diff-view widget/extend slots.
 *
 * - ComposeWidget: shown when user clicks "+" to add a new comment on a line.
 */

import { useCallback } from "react";
import { ComposeBox } from "../shared/ComposeBox";
import type { DiffLineAnchor } from "../../types/sessions";

// ---------------------------------------------------------------------------
// ComposeWidget
// ---------------------------------------------------------------------------

export interface ComposeWidgetProps {
  lineNumber: number;
  /** Start line for multiline selections. Defaults to lineNumber. */
  startLineNumber?: number;
  side: "old" | "new";
  filePath: string;
  onSubmit: (anchor: DiffLineAnchor, text: string) => void;
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
    (text: string) => {
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
      onSubmit(anchor, text);
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
