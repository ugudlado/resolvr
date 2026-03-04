import type { ReviewThread } from "../../services/localReviewApi";

export function OverviewTab({
  threads,
  outdatedThreadIds,
  overviewFilter,
  onFilterChange,
  onThreadClick,
  onReset,
}: {
  threads: ReviewThread[];
  outdatedThreadIds: Set<string>;
  overviewFilter: "all" | "open" | "resolved" | "outdated";
  onFilterChange: (f: "all" | "open" | "resolved" | "outdated") => void;
  onThreadClick: (thread: ReviewThread) => void;
  onReset: () => void;
}) {
  const filtered = threads.filter((t) => {
    const isOutdated = outdatedThreadIds.has(t.id);
    if (overviewFilter === "all") return true;
    if (overviewFilter === "outdated") return isOutdated;
    if (overviewFilter === "open") return t.status === "open" && !isOutdated;
    if (overviewFilter === "resolved")
      return t.status === "resolved" || t.status === "approved";
    return true;
  });

  const filteredByFile = new Map<string, ReviewThread[]>();
  for (const thread of filtered) {
    const list = filteredByFile.get(thread.filePath) || [];
    list.push(thread);
    filteredByFile.set(thread.filePath, list);
  }

  const filterLabels: Array<{ key: typeof overviewFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "outdated", label: "Outdated" },
  ];

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-2">
      <div className="flex flex-wrap gap-1">
        {filterLabels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              overviewFilter === key
                ? "bg-[var(--accent-blue)] text-white"
                : "border border-[var(--border-default)] text-slate-400 hover:bg-[var(--bg-elevated)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="self-start rounded border border-rose-700/50 bg-rose-700/10 px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-700/20"
      >
        Reset Session
      </button>
      {filteredByFile.size === 0 && (
        <p className="text-[11px] text-slate-600">
          No threads match this filter.
        </p>
      )}
      {Array.from(filteredByFile.entries()).map(([filePath, fileThreads]) => {
        const openCount = fileThreads.filter(
          (t) => t.status === "open" && !outdatedThreadIds.has(t.id),
        ).length;
        const outdatedCount = fileThreads.filter((t) =>
          outdatedThreadIds.has(t.id),
        ).length;
        return (
          <div
            key={filePath}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <div className="border-b border-[var(--border-default)] px-2 py-1.5 text-[10px] text-slate-400">
              <span className="font-mono">{filePath.split("/").pop()}</span>
              {openCount > 0 && (
                <span className="ml-1 text-amber-400">· {openCount} open</span>
              )}
              {outdatedCount > 0 && (
                <span className="ml-1 text-slate-500">
                  · {outdatedCount} outdated
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--bg-elevated)]">
              {fileThreads.map((thread) => {
                const isOutdated = outdatedThreadIds.has(thread.id);
                const firstMsg = thread.messages[0];
                const statusIcon = isOutdated
                  ? "◌"
                  : thread.status === "open"
                    ? "●"
                    : "✓";
                const statusColor = isOutdated
                  ? "text-slate-500"
                  : thread.status === "open"
                    ? "text-amber-400"
                    : "text-emerald-400";
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => onThreadClick(thread)}
                    className="w-full px-2 py-1.5 text-left hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-[10px] ${statusColor}`}>
                        {statusIcon}
                      </span>
                      {isOutdated && (
                        <span className="rounded bg-slate-700/50 px-1 text-[9px] text-slate-400">
                          OUTDATED
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600">
                        {thread.side}:{thread.line}
                      </span>
                    </div>
                    {isOutdated && thread.anchorContent && (
                      <code className="mt-0.5 block truncate rounded bg-[var(--bg-base)] px-1 py-0.5 text-[9px] text-slate-500">
                        {thread.anchorContent}
                      </code>
                    )}
                    {firstMsg && (
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        &ldquo;{firstMsg.text.slice(0, 60)}
                        {firstMsg.text.length > 60 ? "…" : ""}&rdquo;
                      </p>
                    )}
                    <p className="mt-0.5 text-[9px] text-slate-600">
                      {thread.messages.length} message
                      {thread.messages.length !== 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
