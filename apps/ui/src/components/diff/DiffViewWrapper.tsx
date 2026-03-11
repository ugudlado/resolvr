/**
 * DiffViewWrapper — Production wrapper around @git-diff-view/react's DiffView.
 *
 * Provides:
 * - Dark theme configuration with pure CSS (avoids Tailwind conflicts)
 * - Widget injection for inline comment compose forms
 * - Extend data for persistent review thread display
 * - Standard props interface for the rest of the app
 */

import { useCallback, useMemo } from "react";
import { DiffView, DiffModeEnum, SplitSide } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";

import type { DiffFile } from "@git-diff-view/react";
import type { ReviewThread } from "../../types/sessions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffViewWrapperProps {
  /** Raw hunk strings from git diff output (starting with @@) */
  hunks: string[];
  /** Old file content (for syntax highlighting) */
  oldContent?: string;
  /** New file content (for syntax highlighting) */
  newContent?: string;
  /** File name (for syntax detection) */
  fileName: string;
  /** Diff view mode: split or unified */
  mode?: "split" | "unified";
  /** Whether to show the "+" add comment buttons */
  enableComments?: boolean;
  /** Called when user clicks "+" to add a comment */
  onAddComment?: (lineNumber: number, side: "old" | "new") => void;
  /** React node to render as widget (e.g., ComposeBox) at active line */
  renderWidget?: (props: {
    lineNumber: number;
    side: "old" | "new";
    onClose: () => void;
  }) => React.ReactNode;
  /** Existing thread data mapped to lines for persistent display */
  threadsByLine?: Map<string, ReviewThread[]>; // key: "old:5" or "new:10"
  /** Render function for thread data at a line */
  renderThreads?: (props: {
    threads: ReviewThread[];
    lineNumber: number;
    side: "old" | "new";
  }) => React.ReactNode;
  /** Whether to wrap long lines */
  wrap?: boolean;
  /** Font size in pixels */
  fontSize?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map our string mode to the library's DiffModeEnum. */
function toDiffMode(mode: "split" | "unified"): DiffModeEnum {
  return mode === "unified" ? DiffModeEnum.Unified : DiffModeEnum.SplitGitHub;
}

/** Map our string side to the library's SplitSide enum. */
function toStringSide(side: SplitSide): "old" | "new" {
  return side === SplitSide.old ? "old" : "new";
}

/**
 * Convert a `threadsByLine` Map (keyed like "old:5" or "new:10") into the
 * `extendData` shape expected by @git-diff-view/react.
 *
 * The library expects:
 * ```
 * { oldFile: { "5": { data: T } }, newFile: { "10": { data: T } } }
 * ```
 */
function buildExtendData(
  threadsByLine: Map<string, ReviewThread[]> | undefined,
): {
  oldFile: Record<string, { data: ReviewThread[] }>;
  newFile: Record<string, { data: ReviewThread[] }>;
} {
  const oldFile: Record<string, { data: ReviewThread[] }> = {};
  const newFile: Record<string, { data: ReviewThread[] }> = {};

  if (!threadsByLine) return { oldFile, newFile };

  for (const [key, threads] of threadsByLine) {
    const colonIdx = key.indexOf(":");
    if (colonIdx === -1) continue;

    const side = key.slice(0, colonIdx);
    const lineStr = key.slice(colonIdx + 1);

    if (side === "old") {
      oldFile[lineStr] = { data: threads };
    } else if (side === "new") {
      newFile[lineStr] = { data: threads };
    }
  }

  return { oldFile, newFile };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiffViewWrapper({
  hunks,
  oldContent,
  newContent,
  fileName,
  mode = "split",
  enableComments = true,
  onAddComment,
  renderWidget,
  threadsByLine,
  renderThreads,
  wrap = false,
  fontSize = 13,
}: DiffViewWrapperProps) {
  // ---- Derived data ----

  const diffMode = toDiffMode(mode);

  const data = useMemo(
    () => ({
      oldFile: {
        fileName,
        content: oldContent ?? null,
      },
      newFile: {
        fileName,
        content: newContent ?? null,
      },
      hunks,
    }),
    [hunks, oldContent, newContent, fileName],
  );

  const extendData = useMemo(
    () => buildExtendData(threadsByLine),
    [threadsByLine],
  );

  // ---- Callbacks ----

  const handleAddWidgetClick = useCallback(
    (lineNumber: number, side: SplitSide) => {
      onAddComment?.(lineNumber, toStringSide(side));
    },
    [onAddComment],
  );

  const handleRenderWidgetLine = useCallback(
    ({
      lineNumber,
      side,
      onClose,
    }: {
      lineNumber: number;
      side: SplitSide;
      diffFile: DiffFile;
      onClose: () => void;
    }) => {
      if (!renderWidget) return null;
      return renderWidget({
        lineNumber,
        side: toStringSide(side),
        onClose,
      });
    },
    [renderWidget],
  );

  const handleRenderExtendLine = useCallback(
    ({
      data: threads,
      lineNumber,
      side,
    }: {
      lineNumber: number;
      side: SplitSide;
      data: ReviewThread[];
      diffFile: DiffFile;
      onUpdate: () => void;
    }) => {
      if (!renderThreads || !threads || threads.length === 0) return null;
      return renderThreads({
        threads,
        lineNumber,
        side: toStringSide(side),
      });
    },
    [renderThreads],
  );

  // ---- Render ----

  return (
    <DiffView
      data={data}
      diffViewMode={diffMode}
      diffViewTheme="dark"
      diffViewHighlight={true}
      diffViewWrap={wrap}
      diffViewFontSize={fontSize}
      diffViewAddWidget={enableComments}
      extendData={extendData}
      onAddWidgetClick={handleAddWidgetClick}
      renderWidgetLine={handleRenderWidgetLine}
      renderExtendLine={handleRenderExtendLine}
    />
  );
}
