/** Returns true when focus is on an input element — used to suppress keyboard shortcuts. */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Scrolls a diff panel to a specific line number.
 * Searches `tr.diff-line[data-state="diff"]` rows for the matching `data-line-{side}-num` attribute.
 */
export function scrollDiffToLine(
  panel: HTMLElement,
  targetLine: number,
  side: "old" | "new",
  options?: { highlight?: boolean },
): void {
  const attr = side === "new" ? "data-line-new-num" : "data-line-old-num";
  const rows = panel.querySelectorAll(`tr.diff-line[data-state="diff"]`);
  for (const row of rows) {
    const span = row.querySelector(`[${attr}]`);
    if (!span) continue;
    if (parseInt(span.getAttribute(attr) ?? "", 10) === targetLine) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      if (options?.highlight) {
        row.classList.add("line-range-highlight");
        setTimeout(() => row.classList.remove("line-range-highlight"), 2000);
      }
      break;
    }
  }
}
