interface ThreadStatusTabsProps {
  activeFilter: "open" | "resolved";
  openCount: number;
  resolvedCount: number;
  onFilterChange: (filter: "open" | "resolved") => void;
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
        "flex border-b border-[var(--border-muted)] bg-[var(--bg-base)]",
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
            ? "border-b-2 border-[var(--accent-blue)] text-[var(--text-primary)]"
            : "border-b-2 border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        }`}
      >
        Open
        {openCount > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeFilter === "open"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
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
            ? "border-b-2 border-[var(--accent-blue)] text-[var(--text-primary)]"
            : "border-b-2 border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        }`}
      >
        Resolved
        {resolvedCount > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeFilter === "resolved"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            {resolvedCount}
          </span>
        )}
      </button>
    </div>
  );
}
