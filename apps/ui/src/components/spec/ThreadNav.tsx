import { useState, useMemo } from "react";
import type { ReviewThread } from "../../types/sessions";
import { THREAD_SEVERITY } from "../../types/constants";
import type { AnchorMap } from "../../utils/specAnchoring";
import { relativeTime } from "../../utils/timeFormat";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThreadNavProps {
  threads: ReviewThread[];
  anchorMap: AnchorMap;
  activeThreadId?: string;
  onThreadClick: (threadId: string) => void;
}

function getSectionLabel(thread: ReviewThread, anchorMap: AnchorMap): string {
  if (thread.anchor.type === "diff-line") return "";
  const anchor = thread.anchor;
  const anchorInfo = anchorMap.get(anchor.blockIndex);
  if (!anchorInfo) return "";
  return anchorInfo.path.split(".")[0] ?? "";
}

// ---------------------------------------------------------------------------
// ThreadNavCard — compact card for a single thread
// ---------------------------------------------------------------------------

interface ThreadNavCardProps {
  thread: ReviewThread;
  anchorMap: AnchorMap;
  isActive: boolean;
  onClick: () => void;
}

function ThreadNavCard({
  thread,
  anchorMap,
  isActive,
  onClick,
}: ThreadNavCardProps) {
  const sectionLabel = getSectionLabel(thread, anchorMap);
  const firstMessage = thread.messages[0];
  const previewText = firstMessage?.text ?? "";
  const author = firstMessage?.author ?? "";
  const time = relativeTime(thread.lastUpdatedAt);

  // Status dot color
  let dotColor: string;
  if (thread.status === "resolved" || thread.status === "approved") {
    dotColor = "text-accent-emerald";
  } else if (thread.severity === THREAD_SEVERITY.Critical) {
    dotColor = "text-accent-rose";
  } else {
    dotColor = "text-accent-blue";
  }

  // Severity badge — show for all severities except default (improvement)
  const showBadge =
    thread.status !== "resolved" &&
    thread.status !== "approved" &&
    thread.severity !== undefined &&
    thread.severity !== THREAD_SEVERITY.Improvement;

  const severityBadgeMap: Record<string, string> = {
    [THREAD_SEVERITY.Critical]: "bg-accent-rose/15 text-accent-rose",
    [THREAD_SEVERITY.Style]: "bg-canvas-overlay text-ink-muted",
    [THREAD_SEVERITY.Question]: "bg-accent-amber/15 text-accent-amber",
  };
  const badgeClasses =
    severityBadgeMap[thread.severity ?? ""] ??
    "bg-accent-blue/15 text-accent-blue";

  return (
    <div
      onClick={onClick}
      className={`hover:bg-canvas-elevated cursor-pointer px-3 py-2 transition-colors ${
        isActive
          ? "bg-accent-blue/8 border-accent-blue -ml-0.5 border-l-2 pl-2.5"
          : ""
      }`}
    >
      {/* Row 1: dot + section + badge */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`shrink-0 text-[8px] leading-none ${dotColor}`}>
          ●
        </span>
        {sectionLabel && (
          <span className="text-accent-blue min-w-0 flex-1 truncate text-[11px] font-medium">
            {sectionLabel}
          </span>
        )}
        {!sectionLabel && <span className="flex-1" />}
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
        <p className="text-ink-muted mt-0.5 truncate text-[12px]">
          {previewText}
        </p>
      )}

      {/* Row 3: author + time */}
      <p className="text-ink-faint mt-0.5 text-[11px]">
        {author}
        {author && " · "}
        {time}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadNav — slim 240px right panel for quick thread navigation
// ---------------------------------------------------------------------------

type TabFilter = "open" | "resolved";

export function ThreadNav({
  threads,
  anchorMap,
  activeThreadId,
  onThreadClick,
}: ThreadNavProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("open");

  // "open" tab: threads with status "open" (includes blocking-severity threads)
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
    <div className="bg-canvas-raised border-border flex w-60 shrink-0 flex-col overflow-hidden border-l">
      {/* Header title */}
      <p className="text-ink-muted px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider">
        Threads
      </p>

      {/* Open / Resolved tabs */}
      <div className="border-border flex items-center gap-0 border-b px-3">
        <button
          type="button"
          onClick={() => setActiveTab("open")}
          className={`-mb-px border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "open"
              ? "text-ink border-accent-blue"
              : "text-ink-muted hover:text-ink border-transparent"
          }`}
        >
          Open ({openThreads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("resolved")}
          className={`-mb-px border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "resolved"
              ? "text-ink border-accent-blue"
              : "text-ink-muted hover:text-ink border-transparent"
          }`}
        >
          Resolved ({resolvedThreads.length})
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-1">
        {visibleThreads.length === 0 ? (
          <p className="text-ink-ghost px-3 py-8 text-center text-[12px]">
            {emptyMessage}
          </p>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadNavCard
              key={thread.id}
              thread={thread}
              anchorMap={anchorMap}
              isActive={thread.id === activeThreadId}
              onClick={() => onThreadClick(thread.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
