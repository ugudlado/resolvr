import { useMemo } from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import { ThreadCard } from "../shared/ThreadCard";
import { SectionLabel } from "../shared/SectionLabel";
import { useThreadPartition } from "../../hooks/useThreadPartition";
import { useResolveStatus } from "../../hooks/useResolveStatus";
import { shortPath } from "../../utils/diffUtils";

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

// ---------------------------------------------------------------------------
// Thread list section (grouped by file)
// ---------------------------------------------------------------------------

function ThreadSection({
  threads,
  selectedFilePath,
  outdatedThreadIds,
  resolvingIds,
  addReply,
  updateThreadStatus,
  onThreadClick,
}: {
  threads: ReviewThread[];
  selectedFilePath: string;
  outdatedThreadIds: Set<string>;
  resolvingIds: Set<string>;
  addReply: (threadId: string, text?: string) => void;
  updateThreadStatus: (
    threadId: string,
    status: ReviewThread["status"],
  ) => void;
  onThreadClick?: (thread: ReviewThread) => void;
}) {
  const grouped = useMemo(() => groupByFile(threads), [threads]);

  return (
    <>
      {Array.from(grouped.entries()).map(([filePath, fileThreads]) => (
        <div key={filePath}>
          {/* File header */}
          <div
            className={`sticky top-8 z-[5] border-b border-[var(--border-muted)] px-2.5 py-1.5 text-[11px] font-medium ${
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
                  isResolving={resolvingIds.has(thread.id)}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// CodeThreadsPanel — single scrollable list with Open / Resolved labels
// ---------------------------------------------------------------------------

export function CodeThreadsPanel({
  threads,
  selectedFilePath,
  outdatedThreadIds,
  addReply,
  updateThreadStatus,
  onThreadClick,
}: CodeThreadsPanelProps) {
  const resolveStatus = useResolveStatus();
  const resolvingIds = new Set(
    resolveStatus.state === "resolving"
      ? resolveStatus.threads
          .filter((t) => !resolveStatus.log.some((e) => e.threadId === t.id))
          .map((t) => t.id)
      : [],
  );

  const { openThreads, resolvedThreads } = useThreadPartition(threads);

  const sharedProps = {
    selectedFilePath,
    outdatedThreadIds,
    resolvingIds,
    addReply,
    updateThreadStatus,
    onThreadClick,
  };

  if (threads.length === 0) {
    return (
      <aside className="flex w-[320px] shrink-0 flex-col border-l border-[var(--border-muted)] bg-[var(--bg-base)]">
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--canvas-raised)] px-3 py-2">
          <span className="text-xs font-medium text-[var(--ink)]">THREADS</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-xs text-slate-600">
          No threads yet
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-[var(--border-muted)] bg-[var(--bg-base)]">
      <div className="flex-1 overflow-y-auto">
        {/* Open section */}
        <SectionLabel label="Open" count={openThreads.length} variant="open" />
        {openThreads.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-600">
            All threads resolved
          </div>
        ) : (
          <ThreadSection threads={openThreads} {...sharedProps} />
        )}

        {/* Resolved section */}
        {resolvedThreads.length > 0 && (
          <>
            <SectionLabel
              label="Resolved"
              count={resolvedThreads.length}
              variant="resolved"
            />
            <ThreadSection threads={resolvedThreads} {...sharedProps} />
          </>
        )}
      </div>
    </aside>
  );
}
