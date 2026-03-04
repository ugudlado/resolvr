import { useCallback, useEffect, useRef, useState } from "react";

export interface DiffSelectionInfo {
  /** The selected text content. */
  text: string;
  /** Start line number of the selection range. */
  startLineNumber: number;
  /** End line number of the selection range (same as start for single-line). */
  lineNumber: number;
  /** Which side of the diff. */
  side: "old" | "new";
}

interface PopoverPosition {
  top: number;
  left: number;
}

export interface DiffSelectionPopoverProps {
  /** The scrollable container scoping selection detection. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when the user clicks "Comment" on a text selection. */
  onComment: (info: DiffSelectionInfo) => void;
}

/**
 * Floating popover that appears when text is selected within diff lines.
 * Shows a "Comment" button positioned near the selection endpoint.
 *
 * Detects selections within `tr.diff-line` rows and extracts line number
 * and side from `data-line-old-num` / `data-line-new-num` attributes.
 */
export function DiffSelectionPopover({
  containerRef,
  onComment,
}: DiffSelectionPopoverProps) {
  const [selection, setSelection] = useState<DiffSelectionInfo | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      setPosition(null);
      return;
    }

    // Find start and end diff rows for multiline selection support
    const startRow = findDiffRow(range.startContainer);
    const endRow = findDiffRow(range.endContainer);
    if (!endRow) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const endLineInfo = extractLineInfo(endRow);
    if (!endLineInfo) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const startLineInfo = startRow ? extractLineInfo(startRow) : null;

    const text = sel.toString().trim();
    if (!text) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Use start row's line if available and on the same side, otherwise fall back to end
    const startLine =
      startLineInfo && startLineInfo.side === endLineInfo.side
        ? Math.min(startLineInfo.lineNumber, endLineInfo.lineNumber)
        : endLineInfo.lineNumber;

    setSelection({
      text,
      startLineNumber: startLine,
      lineNumber: endLineInfo.lineNumber,
      side: endLineInfo.side,
    });
    setPosition({
      top: rect.bottom - containerRect.top + container.scrollTop + 4,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const handleComment = useCallback(() => {
    if (!selection) return;
    onComment(selection);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setPosition(null);
  }, [selection, onComment]);

  if (!selection || !position) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-xl">
        <button
          type="button"
          onClick={handleComment}
          className="border-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/30 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium text-blue-300 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="shrink-0"
          >
            <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h4.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H2.75z" />
          </svg>
          Comment
        </button>
      </div>
    </div>
  );
}

/** Walk up to find the nearest `tr.diff-line` row. */
function findDiffRow(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.tagName === "TR" &&
      current.classList.contains("diff-line") &&
      current.getAttribute("data-state") === "diff"
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/** Extract line number and side from a diff row's line number spans. */
function extractLineInfo(
  row: HTMLElement,
): { lineNumber: number; side: "old" | "new" } | null {
  // Prefer new side line number, fall back to old
  const newNumSpan = row.querySelector("[data-line-new-num]");
  if (newNumSpan) {
    const num = parseInt(
      newNumSpan.getAttribute("data-line-new-num") ?? "",
      10,
    );
    if (!isNaN(num)) return { lineNumber: num, side: "new" };
  }

  const oldNumSpan = row.querySelector("[data-line-old-num]");
  if (oldNumSpan) {
    const num = parseInt(
      oldNumSpan.getAttribute("data-line-old-num") ?? "",
      10,
    );
    if (!isNaN(num)) return { lineNumber: num, side: "old" };
  }

  return null;
}
