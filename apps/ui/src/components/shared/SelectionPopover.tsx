import { useCallback, useEffect, useRef, useState } from "react";

export interface SelectionInfo {
  /** The selected text content. */
  text: string;
  /** Block index of the block where the selection starts. */
  blockIndex: number;
  /** Block index of the block where the selection ends (same as blockIndex for single-block). */
  blockIndexEnd: number;
}

interface PopoverPosition {
  top: number;
  left: number;
}

export interface SelectionPopoverProps {
  /** The scrollable container to scope selection detection to. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when the user clicks "Comment" on a text selection. */
  onComment: (info: SelectionInfo) => void;
}

/**
 * Floating popover that appears when text is selected within annotatable blocks.
 * Shows a "Comment" button positioned near the selection endpoint.
 *
 * Detects selections that start or end inside `[data-block-index]` elements,
 * supporting both single-block and cross-block selections.
 */
export function SelectionPopover({
  containerRef,
  onComment,
}: SelectionPopoverProps) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
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

    // Check if selection is within our container
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      setPosition(null);
      return;
    }

    // Find the block elements at the start and end of the selection
    const startBlock = findBlockElement(range.startContainer);
    const endBlock = findBlockElement(range.endContainer);

    if (!startBlock) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const startIdx = parseInt(
      startBlock.getAttribute("data-block-index") ?? "",
      10,
    );
    const endIdx = endBlock
      ? parseInt(endBlock.getAttribute("data-block-index") ?? "", 10)
      : startIdx;

    if (isNaN(startIdx)) {
      setSelection(null);
      setPosition(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelection(null);
      setPosition(null);
      return;
    }

    // Position the popover near the end of the selection
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setSelection({
      text,
      blockIndex: Math.min(startIdx, isNaN(endIdx) ? startIdx : endIdx),
      blockIndexEnd: Math.max(startIdx, isNaN(endIdx) ? startIdx : endIdx),
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
    // Clear selection after triggering comment
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setPosition(null);
  }, [selection, onComment]);

  if (!selection || !position) return null;

  return (
    <div
      ref={popoverRef}
      className="animate-in fade-in slide-in-from-bottom-1 absolute z-50 -translate-x-1/2 duration-150"
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
        {selection.blockIndex !== selection.blockIndexEnd && (
          <span className="text-[10px] text-slate-500">
            {selection.blockIndexEnd - selection.blockIndex + 1} blocks
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Walk up the DOM tree to find the nearest element with data-block-index.
 */
function findBlockElement(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.hasAttribute("data-block-index")
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
