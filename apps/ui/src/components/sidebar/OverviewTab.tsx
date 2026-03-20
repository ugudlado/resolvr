import type { ReviewThread } from "../../services/localReviewApi";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Format severity label for display */
function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    critical: "Critical",
    improvement: "Improvement",
    style: "Style",
    question: "Question",
    blocking: "Blocking",
    suggestion: "Suggestion",
    nitpick: "Nitpick",
  };
  return map[severity] || severity;
}

/** Format model label for display */
function formatModel(model: string): string {
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

/** Get color classes for severity level */
function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300",
    blocking: "bg-red-500/20 text-red-300",
    improvement: "bg-blue-500/20 text-blue-300",
    style: "bg-amber-500/20 text-amber-300",
    suggestion: "bg-amber-500/20 text-amber-300",
    question: "bg-slate-600/40 text-slate-300",
    nitpick: "bg-slate-600/40 text-slate-300",
  };
  return colors[severity] || "bg-slate-600/40 text-slate-300";
}

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
  overviewFilter: "all" | "open" | "resolved" | "outdated" | "wontfix";
  onFilterChange: (
    f: "all" | "open" | "resolved" | "outdated" | "wontfix",
  ) => void;
  onThreadClick: (thread: ReviewThread) => void;
  onReset: () => void;
}) {
  const filtered = threads.filter((t) => {
    const isOutdated = outdatedThreadIds.has(t.id) || t.status === "outdated";
    if (overviewFilter === "all") return true;
    if (overviewFilter === "outdated") return isOutdated;
    if (overviewFilter === "open") return t.status === "open" && !isOutdated;
    if (overviewFilter === "resolved")
      return t.status === "resolved" || t.status === "approved";
    if (overviewFilter === "wontfix") return t.status === "wontfix";
    return true;
  });

  const filteredByFile = new Map<string, ReviewThread[]>();
  for (const thread of filtered) {
    const list = filteredByFile.get(thread.filePath) ?? [];
    list.push(thread);
    filteredByFile.set(thread.filePath, list);
  }

  const filterLabels: Array<{ key: typeof overviewFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "wontfix", label: "Won't Fix" },
    { key: "outdated", label: "Outdated" },
  ];

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-2">
      <ToggleGroup
        type="single"
        value={overviewFilter}
        onValueChange={(val: string) => {
          if (val) onFilterChange(val as typeof overviewFilter);
        }}
        className="flex flex-wrap gap-1"
      >
        {filterLabels.map(({ key, label }) => (
          <ToggleGroupItem
            key={key}
            value={key}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              overviewFilter === key
                ? "bg-[var(--accent-blue)] text-white"
                : "border border-[var(--border-default)] text-slate-400 hover:bg-[var(--bg-elevated)]"
            }`}
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
                let statusIcon: string;
                if (isOutdated) {
                  statusIcon = "◌";
                } else if (thread.status === "open") {
                  statusIcon = "●";
                } else {
                  statusIcon = "✓";
                }
                let statusColor: string;
                if (isOutdated) {
                  statusColor = "text-slate-500";
                } else if (thread.status === "open") {
                  statusColor = "text-amber-400";
                } else {
                  statusColor = "text-emerald-400";
                }
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
                    {thread.labels &&
                      Object.entries(thread.labels).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {thread.labels.severity && (
                            <span
                              className={`rounded px-2 py-1 text-[9px] font-medium ${severityColor(thread.labels.severity)}`}
                            >
                              {formatSeverity(thread.labels.severity)}
                            </span>
                          )}
                          {thread.labels.model && (
                            <span className="rounded bg-indigo-500/20 px-2 py-1 text-[9px] font-medium text-indigo-300">
                              {formatModel(thread.labels.model)}
                            </span>
                          )}
                          {Object.entries(thread.labels)
                            .filter(([k]) => !["severity", "model"].includes(k))
                            .map(([key, value]) => (
                              <span
                                key={`${thread.id}-${key}`}
                                className="rounded bg-slate-600/40 px-2 py-1 text-[8px] text-slate-300"
                                title={`${key}: ${value}`}
                              >
                                {key}
                              </span>
                            ))}
                        </div>
                      )}
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
