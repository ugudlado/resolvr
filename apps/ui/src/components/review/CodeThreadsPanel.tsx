import { useState, useMemo } from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import { ThreadCard } from "../shared/ThreadCard";
import { ThreadStatusTabs } from "../shared/ThreadStatusTabs";
import { useThreadPartition } from "../../hooks/useThreadPartition";
import type { ThreadFilter } from "../../types/sessions";

export interface CodeThreadsPanelProps {
  threads: ReviewThread[];
  selectedFilePath: string;
  outdatedThreadIds: Set<string>;
  addReply: (threadId: string, text?: string) => void;
  updateThreadStatus: (
    threadId: string,
    status: ReviewThread["status"],
  ) => void;
  onThreadClick?: (thread: ReviewThread) => void;
}

/** Group threads by filePath, preserving insertion order. */
function groupByFile(threads: ReviewThread[]): Map<string, ReviewThread[]> {
  const map = new Map<string, ReviewThread[]>();
  for (const t of threads) {
    const existing = map.get(t.filePath);
    if (existing) {
      existing.push(t);
    } else {
      map.set(t.filePath, [t]);
    }
  }
  return map;
}

/** Shorten a file path to just the last 2 segments for display. */
function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length <= 2 ? filePath : parts.slice(-2).join("/");
}

export function CodeThreadsPanel({
  threads,
  selectedFilePath,
  outdatedThreadIds,
  addReply,
  updateThreadStatus,
  onThreadClick,
}: CodeThreadsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<ThreadFilter>("open");

  const { openThreads, resolvedThreads } = useThreadPartition(threads);

  const filteredThreads =
    activeFilter === "open" ? openThreads : resolvedThreads;

  const grouped = useMemo(
    () => groupByFile(filteredThreads),
    [filteredThreads],
  );

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-[var(--border-muted)] bg-[var(--bg-base)]">
      {/* Tab header — Open / Resolved */}
      <ThreadStatusTabs
        activeFilter={activeFilter}
        openCount={openThreads.length}
        resolvedCount={resolvedThreads.length}
        onFilterChange={setActiveFilter}
        sticky
      />

      {/* Thread list grouped by file */}
      {filteredThreads.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-xs text-slate-600">
          {activeFilter === "open"
            ? threads.length === 0
              ? "No threads yet"
              : "All threads resolved"
            : "No resolved threads"}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {Array.from(grouped.entries()).map(([filePath, fileThreads]) => (
            <div key={filePath}>
              {/* File header */}
              <div
                className={`sticky top-0 z-[5] border-b border-[var(--border-muted)] px-2.5 py-1.5 text-[11px] font-medium ${
                  filePath === selectedFilePath
                    ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue-text)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                }`}
                title={filePath}
              >
                {shortPath(filePath)}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {fileThreads.length}
                </span>
              </div>
              {/* Threads for this file */}
              <div className="space-y-2 p-2">
                {fileThreads.map((thread, index) => (
                  <div
                    key={thread.id}
                    onClick={() => onThreadClick?.(thread)}
                    className={`stagger-fade-in ${
                      onThreadClick
                        ? "cursor-pointer rounded transition-colors hover:bg-[var(--bg-surface)]"
                        : ""
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {outdatedThreadIds.has(thread.id) && (
                      <div className="mb-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                        Outdated
                      </div>
                    )}
                    <ThreadCard
                      thread={thread}
                      onReply={(threadId, text) => addReply(threadId, text)}
                      onStatusChange={(threadId, status) =>
                        updateThreadStatus(threadId, status)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
