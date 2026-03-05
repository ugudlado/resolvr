import { useState, useMemo } from "react";
import type { ReviewThread } from "../../services/localReviewApi";

/** Extended thread with optional severity (may come from adapted threads). */
type ThreadWithSeverity = ReviewThread & {
  severity?: "blocking" | "suggestion" | "nitpick";
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffThreadNavProps {
  threads: ReviewThread[];
  activeThreadId?: string;
  onThreadClick: (thread: ReviewThread) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Shorten a file path to just the last 2 segments for display. */
function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length <= 2 ? filePath : parts.slice(-2).join("/");
}

/** Format line range label. */
function lineLabel(line: number, lineEnd?: number): string {
  if (lineEnd && lineEnd !== line) return `L${line}-L${lineEnd}`;
  return `L${line}`;
}

// ---------------------------------------------------------------------------
// ThreadNavCard — compact card for a single thread
// ---------------------------------------------------------------------------

interface ThreadNavCardProps {
  thread: ThreadWithSeverity;
  isActive: boolean;
  onClick: () => void;
}

function ThreadNavCard({ thread, isActive, onClick }: ThreadNavCardProps) {
  const firstMessage = thread.messages[0];
  const previewText = firstMessage?.text ?? "";
  const author = firstMessage?.author ?? "";
  const time = relativeTime(thread.lastUpdatedAt);

  // Status dot color
  let dotColor: string;
  if (thread.status === "resolved" || thread.status === "approved") {
    dotColor = "text-[var(--accent-emerald)]";
  } else if (thread.severity === "blocking") {
    dotColor = "text-[var(--accent-amber)]";
  } else {
    dotColor = "text-[var(--accent-blue)]";
  }

  // Severity badge
  const showBadge =
    thread.status !== "resolved" &&
    thread.status !== "approved" &&
    (thread.severity === "blocking" || thread.severity === "suggestion");

  const badgeClasses =
    thread.severity === "blocking"
      ? "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]"
      : "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]";

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer px-3 py-2 transition-colors hover:bg-[var(--canvas-elevated)] ${
        isActive
          ? "-ml-0.5 border-l-2 border-[var(--accent-blue)] bg-[var(--accent-blue-dim)] pl-2.5"
          : ""
      }`}
    >
      {/* Row 1: dot + file:line + badge */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`shrink-0 text-[8px] leading-none ${dotColor}`}>
          ●
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--accent-blue)]">
          {shortPath(thread.filePath)}:{lineLabel(thread.line, thread.lineEnd)}
        </span>
        {showBadge && (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${badgeClasses}`}
          >
            {thread.severity}
          </span>
        )}
      </div>

      {/* Row 2: preview text */}
      {previewText && (
        <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">
          {previewText}
        </p>
      )}

      {/* Row 3: author + time */}
      <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
        {author}
        {author && " \u00B7 "}
        {time}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffThreadNav — slim 240px right panel for quick thread navigation
// ---------------------------------------------------------------------------

type TabFilter = "open" | "resolved";

export function DiffThreadNav({
  threads,
  activeThreadId,
  onThreadClick,
}: DiffThreadNavProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("open");

  const openThreads = useMemo(
    () => threads.filter((t) => t.status === "open"),
    [threads],
  );

  const resolvedThreads = useMemo(
    () =>
      threads.filter((t) => t.status === "resolved" || t.status === "approved"),
    [threads],
  );

  const visibleThreads = useMemo(() => {
    const source = activeTab === "open" ? openThreads : resolvedThreads;
    return [...source].sort(
      (a, b) =>
        new Date(b.lastUpdatedAt).getTime() -
        new Date(a.lastUpdatedAt).getTime(),
    );
  }, [activeTab, openThreads, resolvedThreads]);

  const emptyMessage =
    activeTab === "open" ? "No open threads" : "No resolved threads";

  return (
    <div className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--canvas-raised)]">
      {/* Header title */}
      <p className="px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
        Threads
      </p>

      {/* Open / Resolved tabs */}
      <div className="flex items-center gap-0 border-b border-[var(--border)] px-3">
        <button
          type="button"
          onClick={() => setActiveTab("open")}
          className={`-mb-px border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "open"
              ? "border-[var(--accent-blue)] text-[var(--ink)]"
              : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Open ({openThreads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("resolved")}
          className={`-mb-px border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "resolved"
              ? "border-[var(--accent-blue)] text-[var(--ink)]"
              : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Resolved ({resolvedThreads.length})
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-1">
        {visibleThreads.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--ink-ghost)]">
            {emptyMessage}
          </p>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadNavCard
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => onThreadClick(thread)}
            />
          ))
        )}
      </div>
    </div>
  );
}
