/**
 * SelectionComposePortal — Renders an inline compose form after a diff row
 * using a React portal. This bypasses the @git-diff-view library's widget
 * slot system, which can't be programmatically opened.
 *
 * Used for the text-selection → Comment flow where we need to show a compose
 * form at a specific line without going through the library's add-widget mechanism.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ComposeWidget } from "./ThreadWidget";
import type { DiffLineAnchor, ThreadSeverity } from "../../types/sessions";

export interface SelectionComposePortalProps {
  /** The scrollable container that holds the diff table. */
  containerRef: React.RefObject<HTMLElement | null>;
  lineNumber: number;
  startLineNumber?: number;
  side: "old" | "new";
  filePath: string;
  selectedText: string;
  onSubmit: (
    anchor: DiffLineAnchor,
    text: string,
    severity?: ThreadSeverity,
  ) => void;
  onClose: () => void;
}

/**
 * Finds the target diff row and injects a portal container <tr> after it,
 * then renders a ComposeWidget inside via createPortal.
 */
export function SelectionComposePortal({
  containerRef,
  lineNumber,
  startLineNumber,
  side,
  filePath,
  selectedText,
  onSubmit,
  onClose,
}: SelectionComposePortalProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const injectedRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Find the target diff row by line number and side
    const targetRow = findTargetRow(container, lineNumber, side);
    if (!targetRow) return;

    // Create a new <tr> to hold the compose form, inserted after the target row
    const tr = document.createElement("tr");
    tr.className = "selection-compose-row";
    const td = document.createElement("td");
    td.colSpan = 20; // span all columns
    td.className = "p-0";
    tr.appendChild(td);

    targetRow.after(tr);
    injectedRowRef.current = tr;
    setPortalContainer(td);

    // Scroll the compose form into view
    requestAnimationFrame(() => {
      tr.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    return () => {
      tr.remove();
      injectedRowRef.current = null;
      setPortalContainer(null);
    };
  }, [containerRef, lineNumber, side]);

  if (!portalContainer) return null;

  return createPortal(
    <ComposeWidget
      lineNumber={lineNumber}
      startLineNumber={startLineNumber}
      side={side}
      filePath={filePath}
      onSubmit={onSubmit}
      onClose={onClose}
      quotedText={selectedText}
    />,
    portalContainer,
  );
}

/** Find a diff row matching the given line number and side. */
function findTargetRow(
  container: HTMLElement,
  lineNumber: number,
  side: "old" | "new",
): HTMLElement | null {
  const attr = side === "new" ? "data-line-new-num" : "data-line-old-num";
  const rows = container.querySelectorAll(`tr.diff-line[data-state="diff"]`);
  for (const row of rows) {
    const span = row.querySelector(`[${attr}]`);
    if (!span) continue;
    const num = parseInt(span.getAttribute(attr) ?? "", 10);
    if (num === lineNumber) return row as HTMLElement;
  }
  return null;
}
