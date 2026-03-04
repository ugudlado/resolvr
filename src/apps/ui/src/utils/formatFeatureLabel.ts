/**
 * Formats a feature ID slug into a readable "YYYY-MM-DD — Title Case Name" display string.
 * e.g. "2026-03-02-redesign-review-spec-code-tool" → "2026-03-02 — Redesign Review Spec Code Tool"
 * Falls back to the raw ID if it doesn't match the date-prefix pattern.
 */
export function formatFeatureLabel(id: string): string {
  const match = id.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (!match) return id;
  const date = match[1];
  const name = match[2]
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${date} — ${name}`;
}
