import type { ThreadFilter } from "../../types/sessions";

interface ThreadStatusTabsProps {
  activeFilter: ThreadFilter;
  openCount: number;
  resolvedCount: number;
  onFilterChange: (filter: ThreadFilter) => void;
  sticky?: boolean;
}

export function ThreadStatusTabs({
  activeFilter,
  openCount,
  resolvedCount,
  onFilterChange,
  sticky,
}: ThreadStatusTabsProps) {
  return (
    <div
      className={[
        "flex border-b border-[var(--border)] bg-[var(--canvas-raised)] font-sans",
        sticky && "sticky top-0 z-10",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => onFilterChange("open")}
        className={`status-badge flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
          activeFilter === "open"
            ? "border-b-2 border-[var(--accent-blue)] text-[var(--ink)]"
            : "border-b-2 border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
        }`}
      >
        Open
        {openCount > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeFilter === "open"
                ? "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]"
                : "bg-[var(--canvas-elevated)] text-[var(--ink-ghost)]"
            }`}
          >
            {openCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onFilterChange("resolved")}
        className={`status-badge flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
          activeFilter === "resolved"
            ? "border-b-2 border-[var(--accent-blue)] text-[var(--ink)]"
            : "border-b-2 border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
        }`}
      >
        Resolved
        {resolvedCount > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeFilter === "resolved"
                ? "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]"
                : "bg-[var(--canvas-elevated)] text-[var(--ink-ghost)]"
            }`}
          >
            {resolvedCount}
          </span>
        )}
      </button>
    </div>
  );
}
