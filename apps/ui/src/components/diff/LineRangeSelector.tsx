/**
 * LineRangeSelector — GitHub-style click+drag on the "+" button to select a
 * line range for commenting.
 *
 * Interactions:
 * - Click the "+" button → selects that single line, shows comment button.
 * - Click "+" and drag across rows → selects a range, shows comment button.
 * - Shift+click another "+" → extends selection to a range.
 * - Click elsewhere / Escape → clears selection.
 *
 * The "+" buttons are rendered by @git-diff-view as
 * `<div data-add-widget="new|old"><button class="diff-add-widget">+</button></div>`
 * inside each `tr.diff-line` row.
 */

import { useCallback, useEffect, useRef } from "react";

export interface LineRangeSelection {
  startLine: number;
  endLine: number;
  side: "old" | "new";
}

export interface LineRangeSelectorProps {
  /** The scrollable container that holds the diff table. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when user clicks "Comment" on a line range selection. */
  onComment: (selection: LineRangeSelection) => void;
}

/**
 * Attaches mouse event listeners to the "+" add-widget buttons inside a diff
 * table to enable click+drag and Shift+click range selection.
 */
export function LineRangeSelector({
  containerRef,
  onComment,
}: LineRangeSelectorProps) {
  // Selection state is only tracked via ref (no UI to render).
  // The component is purely behavioral — it calls onComment directly on mouseup.

  // Track drag state without causing re-renders
  const dragRef = useRef<{
    active: boolean;
    startLine: number;
    side: "old" | "new";
  } | null>(null);

  // Last single-click line for Shift+click extension
  const lastClickRef = useRef<{
    line: number;
    side: "old" | "new";
  } | null>(null);

  // Mirror selection state in a ref so mouseup can read it synchronously
  const selectionRef = useRef<LineRangeSelection | null>(null);

  /** Update the selection ref. */
  const updateSelection = useCallback((sel: LineRangeSelection | null) => {
    selectionRef.current = sel;
  }, []);

  /**
   * Check if `el` is inside (or is) a `+` add-widget button.
   * Returns the side and line number from the parent diff row, or null.
   */
  const parseAddWidget = useCallback(
    (el: HTMLElement): { line: number; side: "old" | "new" } | null => {
      // Walk up to find [data-add-widget]
      let widgetDiv: HTMLElement | null = null;
      const foundWidget = el.closest("[data-add-widget]");
      if (foundWidget instanceof HTMLElement) widgetDiv = foundWidget;
      if (!widgetDiv) {
        // Also try walking up manually for older browsers
        let cur: HTMLElement | null = el;
        while (cur && cur !== containerRef.current) {
          if (cur.hasAttribute?.("data-add-widget")) {
            widgetDiv = cur;
            break;
          }
          cur = cur.parentElement;
        }
      }
      if (!widgetDiv) return null;

      const sideAttr = widgetDiv.getAttribute("data-add-widget");
      if (sideAttr !== "old" && sideAttr !== "new") return null;

      // Find the parent diff row to get the line number
      const foundRow = widgetDiv.closest('tr.diff-line[data-state="diff"]');
      const row = foundRow instanceof HTMLElement ? foundRow : null;
      if (!row) return null;

      const attr =
        sideAttr === "new" ? "data-line-new-num" : "data-line-old-num";
      const span = row.querySelector(`[${attr}]`);
      if (!span) return null;

      const line = parseInt(span.getAttribute(attr) ?? "", 10);
      if (isNaN(line)) return null;

      return { line, side: sideAttr };
    },
    [containerRef],
  );

  /** Extract line number from a diff row for the given side (used during drag). */
  const getLineFromRow = useCallback(
    (row: HTMLElement, side: "old" | "new"): number | null => {
      const attr = side === "new" ? "data-line-new-num" : "data-line-old-num";
      const span = row.querySelector(`[${attr}]`);
      if (!span) return null;
      const num = parseInt(span.getAttribute(attr) ?? "", 10);
      return isNaN(num) ? null : num;
    },
    [],
  );

  /** Find the nearest diff row from any element. */
  const findDiffRow = useCallback(
    (el: HTMLElement): HTMLElement | null => {
      let cur: HTMLElement | null = el;
      while (cur && cur !== containerRef.current) {
        if (
          cur.tagName === "TR" &&
          cur.classList.contains("diff-line") &&
          cur.getAttribute("data-state") === "diff"
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    },
    [containerRef],
  );

  /** Find all diff rows and highlight the selected range. */
  const highlightRange = useCallback(
    (startLine: number, endLine: number, side: "old" | "new") => {
      const container = containerRef.current;
      if (!container) return;

      const lo = Math.min(startLine, endLine);
      const hi = Math.max(startLine, endLine);
      const attr = side === "new" ? "data-line-new-num" : "data-line-old-num";

      // Remove old highlights
      container
        .querySelectorAll(".line-range-highlight")
        .forEach((el) => el.classList.remove("line-range-highlight"));

      // Add highlights to rows in range
      const rows = container.querySelectorAll(
        `tr.diff-line[data-state="diff"]`,
      );

      for (const row of rows) {
        const span = row.querySelector(`[${attr}]`);
        if (!span) continue;
        const num = parseInt(span.getAttribute(attr) ?? "", 10);
        if (isNaN(num)) continue;
        if (num >= lo && num <= hi) {
          row.classList.add("line-range-highlight");
        }
      }
    },
    [containerRef],
  );

  /** Clear all highlights and selection. */
  const clearSelection = useCallback(() => {
    selectionRef.current = null;
    dragRef.current = null;
    lastClickRef.current = null;

    const container = containerRef.current;
    if (container) {
      container
        .querySelectorAll(".line-range-highlight")
        .forEach((el) => el.classList.remove("line-range-highlight"));
    }
  }, [containerRef]);

  // Inject highlight styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .line-range-highlight > td {
        background-color: rgba(31, 111, 235, 0.12) !important;
      }
      .line-range-highlight > td:first-child,
      .line-range-highlight > td:nth-child(2) {
        background-color: rgba(31, 111, 235, 0.2) !important;
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
      const info = parseAddWidget(target);
      if (!info) return;

      // Prevent the library's own onAddWidgetClick from firing
      e.stopPropagation();
      e.preventDefault();

      // Shift+click: extend from last click
      if (e.shiftKey && lastClickRef.current) {
        const prev = lastClickRef.current;
        if (prev.side === info.side) {
          const lo = Math.min(prev.line, info.line);
          const hi = Math.max(prev.line, info.line);
          updateSelection({ startLine: lo, endLine: hi, side: info.side });
          highlightRange(lo, hi, info.side);
          return;
        }
      }

      // Start drag
      dragRef.current = {
        active: true,
        startLine: info.line,
        side: info.side,
      };
      lastClickRef.current = { line: info.line, side: info.side };

      // Immediately highlight the single line
      highlightRange(info.line, info.line, info.side);
      updateSelection({
        startLine: info.line,
        endLine: info.line,
        side: info.side,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag?.active) return;

      const target = document.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement | null;
      if (!target) return;

      // Find the diff row under the cursor (works whether hovering over
      // line numbers, code content, or the + button itself)
      const row = findDiffRow(target);
      if (!row) return;

      const num = getLineFromRow(row, drag.side);
      if (num === null) return;

      const lo = Math.min(drag.startLine, num);
      const hi = Math.max(drag.startLine, num);
      highlightRange(lo, hi, drag.side);
      updateSelection({ startLine: lo, endLine: hi, side: drag.side });
    };

    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (!drag?.active) return;
      drag.active = false;

      // Open compose immediately for both single clicks and drag ranges.
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

    // Use capture phase on mousedown so we intercept before the library
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
    parseAddWidget,
    findDiffRow,
    getLineFromRow,
    highlightRange,
    clearSelection,
    clearSelection,
    updateSelection,
    onComment,
  ]);

  // Purely behavioral — no UI to render.
  return null;
}
