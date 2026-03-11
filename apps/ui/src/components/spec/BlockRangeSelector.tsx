/**
 * BlockRangeSelector — click+drag on "+" buttons to select a range of spec
 * blocks for commenting.
 *
 * Interactions:
 * - Click "+" button → single block selected, fires onComment immediately.
 * - Click "+" and drag across blocks → selects a range, fires onComment on mouseup.
 * - Shift+click another "+" → extends selection from last click to current.
 * - Escape → clears selection.
 *
 * The "+" buttons are rendered by AnnotatableParagraph as
 * `<button data-compose-button="{blockIndex}">+</button>`
 * inside each `[data-block-index]` container.
 *
 * Follows the LineRangeSelector pattern: renders null, ref-based state,
 * capture-phase event listeners.
 */

import { useCallback, useEffect, useRef } from "react";

export interface BlockRangeSelection {
  startBlockIndex: number;
  endBlockIndex: number;
}

export interface BlockRangeSelectorProps {
  /** The scrollable container that holds the spec content. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when user completes a block range selection. */
  onComment: (selection: BlockRangeSelection) => void;
}

export function BlockRangeSelector({
  containerRef,
  onComment,
}: BlockRangeSelectorProps) {
  const dragRef = useRef<{
    active: boolean;
    startBlockIndex: number;
  } | null>(null);

  const lastClickRef = useRef<number | null>(null);
  const selectionRef = useRef<BlockRangeSelection | null>(null);

  /** Parse a compose button element to get its block index. */
  const parseComposeButton = useCallback(
    (el: HTMLElement): number | null => {
      const btn = el.closest("[data-compose-button]");
      if (!btn || !containerRef.current?.contains(btn)) return null;
      const val = parseInt(btn.getAttribute("data-compose-button") ?? "", 10);
      return isNaN(val) ? null : val;
    },
    [containerRef],
  );

  /** Find the block index from any element under the cursor during drag. */
  const findBlockIndex = useCallback(
    (el: HTMLElement): number | null => {
      const block = el.closest("[data-block-index]");
      if (!block || !containerRef.current?.contains(block)) return null;
      const val = parseInt(block.getAttribute("data-block-index") ?? "", 10);
      return isNaN(val) ? null : val;
    },
    [containerRef],
  );

  /** Highlight blocks in the given range. */
  const highlightRange = useCallback(
    (start: number, end: number) => {
      const container = containerRef.current;
      if (!container) return;

      const lo = Math.min(start, end);
      const hi = Math.max(start, end);

      // Clear old highlights
      container
        .querySelectorAll(".block-range-highlight")
        .forEach((el) => el.classList.remove("block-range-highlight"));

      // Add highlights to blocks in range
      const blocks = container.querySelectorAll("[data-block-index]");
      for (const block of blocks) {
        const idx = parseInt(block.getAttribute("data-block-index") ?? "", 10);
        if (!isNaN(idx) && idx >= lo && idx <= hi) {
          block.classList.add("block-range-highlight");
        }
      }
    },
    [containerRef],
  );

  /** Clear all highlights and state. */
  const clearSelection = useCallback(() => {
    selectionRef.current = null;
    dragRef.current = null;
    lastClickRef.current = null;
    const container = containerRef.current;
    if (container) {
      container
        .querySelectorAll(".block-range-highlight")
        .forEach((el) => el.classList.remove("block-range-highlight"));
    }
  }, [containerRef]);

  // Inject highlight + flash styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .block-range-highlight {
        background-color: rgba(31, 111, 235, 0.12) !important;
        border-left-color: var(--accent-blue) !important;
      }
      @keyframes block-flash {
        0% { background-color: rgba(31, 111, 235, 0.25); }
        100% { background-color: transparent; }
      }
      .block-flash-highlight {
        animation: block-flash 1.5s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  // Mouse event handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const blockIndex = parseComposeButton(target);
      if (blockIndex === null) return;

      // Prevent AnnotatableParagraph's onClick from firing
      e.stopPropagation();
      e.preventDefault();

      // Shift+click: extend from last click
      if (e.shiftKey && lastClickRef.current !== null) {
        const lo = Math.min(lastClickRef.current, blockIndex);
        const hi = Math.max(lastClickRef.current, blockIndex);
        selectionRef.current = { startBlockIndex: lo, endBlockIndex: hi };
        highlightRange(lo, hi);
        return;
      }

      // Start drag
      dragRef.current = { active: true, startBlockIndex: blockIndex };
      lastClickRef.current = blockIndex;
      highlightRange(blockIndex, blockIndex);
      selectionRef.current = {
        startBlockIndex: blockIndex,
        endBlockIndex: blockIndex,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag?.active) return;

      const target = document.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement | null;
      if (!target) return;

      const blockIndex = findBlockIndex(target);
      if (blockIndex === null) return;

      const lo = Math.min(drag.startBlockIndex, blockIndex);
      const hi = Math.max(drag.startBlockIndex, blockIndex);
      highlightRange(lo, hi);
      selectionRef.current = { startBlockIndex: lo, endBlockIndex: hi };
    };

    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (!drag?.active) return;
      drag.active = false;

      if (selectionRef.current) {
        onComment(selectionRef.current);
        clearSelection();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    // Capture phase on mousedown to intercept before AnnotatableParagraph's onClick
    container.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    containerRef,
    parseComposeButton,
    findBlockIndex,
    highlightRange,
    clearSelection,
    onComment,
  ]);

  return null;
}
