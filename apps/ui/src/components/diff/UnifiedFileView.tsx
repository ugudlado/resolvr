/**
 * UnifiedFileView — Replacement for FullFileView using @git-diff-view/react
 * in unified mode.
 *
 * Shows a single file's complete content (not just diff hunks) in unified
 * diff view mode. When hunks are provided they are passed through directly;
 * when only file content is available a synthetic "all added" hunk is
 * generated so every line is visible.
 */

import { useMemo } from "react";

import { DiffViewWrapper } from "./DiffViewWrapper";
import type { ReviewThread } from "../../types/sessions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UnifiedFileViewProps {
  /** File name / path for display and syntax detection. */
  fileName: string;
  /** Full file content (new version). */
  content: string;
  /** Old version of the file (if available, for true diff display). */
  oldContent?: string;
  /** Diff hunks (if available). When omitted, a synthetic hunk is built. */
  hunks?: string[];
  /** Review threads anchored to this file. */
  threads?: ReviewThread[];
  /** Called when the user clicks "+" to start a new comment. */
  onAddComment?: (lineNumber: number, side: "old" | "new") => void;
  /** Render function for the inline compose widget. */
  renderWidget?: (props: {
    lineNumber: number;
    side: "old" | "new";
    onClose: () => void;
  }) => React.ReactNode;
  /** Render function for persistent review threads at a given line. */
  renderThreads?: (props: {
    threads: ReviewThread[];
    lineNumber: number;
    side: "old" | "new";
  }) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a synthetic unified-diff hunk that marks every line in `content` as
 * added. This lets DiffViewWrapper render the full file even when no real
 * git diff hunks exist.
 */
function buildSyntheticAllAddedHunk(content: string): string[] {
  const lines = content.split("\n");
  // Trailing empty string from a final newline should still be included so
  // line counts stay accurate, but we avoid an off-by-one for files that
  // end with a newline.
  const lineCount = lines.length;

  const header = `@@ -0,0 +1,${lineCount} @@`;
  const body = lines.map((l) => `+${l}`).join("\n");

  return [`${header}\n${body}`];
}

/**
 * Convert a flat array of ReviewThreads (each with a DiffLineAnchor) into
 * the `threadsByLine` Map expected by DiffViewWrapper.
 *
 * Key format: `"old:{line}"` or `"new:{line}"`.
 */
function threadsToMap(
  threads: ReviewThread[] | undefined,
): Map<string, ReviewThread[]> | undefined {
  if (!threads || threads.length === 0) return undefined;

  const map = new Map<string, ReviewThread[]>();

  for (const thread of threads) {
    if (thread.anchor.type !== "diff-line") continue;

    const key = `${thread.anchor.side}:${thread.anchor.line}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(thread);
    } else {
      map.set(key, [thread]);
    }
  }

  return map.size > 0 ? map : undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UnifiedFileView({
  fileName,
  content,
  oldContent,
  hunks,
  threads,
  onAddComment,
  renderWidget,
  renderThreads,
}: UnifiedFileViewProps) {
  // If real hunks are provided, use them; otherwise synthesize from content.
  const resolvedHunks = useMemo(
    () =>
      hunks && hunks.length > 0 ? hunks : buildSyntheticAllAddedHunk(content),
    [hunks, content],
  );

  const threadsByLine = useMemo(() => threadsToMap(threads), [threads]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg-base)]">
      <DiffViewWrapper
        hunks={resolvedHunks}
        oldContent={oldContent ?? ""}
        newContent={content}
        fileName={fileName}
        mode="unified"
        enableComments={!!onAddComment}
        onAddComment={onAddComment}
        renderWidget={renderWidget}
        threadsByLine={threadsByLine}
        renderThreads={renderThreads}
      />
    </div>
  );
}

export default UnifiedFileView;
