import { useMemo, useState } from "react";
import { ChevronRightIcon, MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewThread } from "../../services/localReviewApi";
import { THREAD_SEVERITY } from "../../types/sessions";
import { relativeTime } from "../../utils/timeFormat";
import { shortPath, lineLabel } from "../../utils/diffUtils";
import { useResolveStatus } from "../../hooks/useResolveStatus";
import { normalizeStatus, isClosed } from "../../utils/threadStatus";
import { KeyboardHint } from "../shared/KeyboardHint";
import { SectionLabel } from "../shared/SectionLabel";
import { ThreadStatusBadge } from "../shared/ThreadStatusBadge";

/** Extended thread with optional severity (may come from adapted threads or legacy API). */
type ThreadWithSeverity = Omit<ReviewThread, "severity"> & {
  severity?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffThreadNavProps {
  threads: ReviewThread[];
  activeThreadId?: string;
  onThreadClick: (thread: ReviewThread) => void;
  outdatedThreadIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Label formatters
// ---------------------------------------------------------------------------

function formatSeverityLabel(severity: string): string {
  if (severity === "improvement") return "Improvement";
  if (severity === "critical") return "Critical";
  if (severity === "style") return "Style";
  return severity;
}

function formatModelLabel(model: string): string {
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortByUpdated(threads: ReviewThread[]): ReviewThread[] {
  return [...threads].sort(
    (a, b) =>
      new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// ThreadNavCard — compact card for a single thread
// ---------------------------------------------------------------------------

interface ThreadNavCardProps {
  thread: ThreadWithSeverity;
  isActive: boolean;
  isResolving: boolean;
  onClick: () => void;
}

function ThreadNavCard({
  thread,
  isActive,
  isResolving,
  onClick,
}: ThreadNavCardProps) {
  const firstMessage = thread.messages[0];
  const previewText = firstMessage?.text ?? "";
  const author = firstMessage?.author ?? "";
  const time = relativeTime(thread.lastUpdatedAt);
  const closed = isClosed(thread.status);

  // Severity badge — show for open threads with non-default severity
  const showBadge =
    !closed &&
    thread.severity !== undefined &&
    thread.severity !== null &&
    thread.severity !== THREAD_SEVERITY.Improvement;

  const severityBadgeClasses: Record<string, string> = {
    [THREAD_SEVERITY.Critical]:
      "bg-[var(--accent-rose-dim)] text-[var(--accent-rose)]",
    [THREAD_SEVERITY.Style]:
      "bg-[var(--bg-overlay)] text-[var(--text-secondary)]",
    [THREAD_SEVERITY.Question]:
      "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]",
  };
  const badgeClasses =
    severityBadgeClasses[thread.severity ?? ""] ??
    "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer px-3 py-2 transition-colors hover:bg-[var(--bg-elevated)]",
        isActive &&
          "-ml-0.5 border-l-2 border-[var(--accent-blue)] bg-[var(--accent-blue-dim)] pl-2.5",
      )}
    >
      {/* Row 1: status badge + file:line + severity badge */}
      <div className="flex min-w-0 items-center gap-1.5">
        {isResolving ? (
          <span className="shrink-0 animate-[breathe_2s_ease-in-out_infinite] text-[8px] leading-none text-[var(--accent-blue)]">
            ●
          </span>
        ) : (
          <ThreadStatusBadge status={thread.status} size="sm" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--accent-blue)]">
          {shortPath(thread.filePath)}:{lineLabel(thread.line, thread.lineEnd)}
        </span>
        {isResolving && (
          <span className="shrink-0 rounded bg-[var(--accent-blue-dim)] px-1 py-0.5 text-[9px] text-[var(--accent-blue)]">
            resolving…
          </span>
        )}
        {!isResolving && showBadge && (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${badgeClasses}`}
          >
            {thread.severity}
          </span>
        )}
      </div>

      {/* Row 2: preview text */}
      {previewText && (
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
          {previewText}
        </p>
      )}

      {/* Row 3: author + time + hover chevron */}
      <div className="mt-0.5 flex items-center">
        <p className="flex-1 text-[11px] text-[var(--text-tertiary)]">
          {author}
          {author && " \u00B7 "}
          {time}
        </p>
        <ChevronRightIcon
          size={12}
          className="shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      {/* Row 4: analytics labels for closed threads */}
      {closed && thread.labels && Object.keys(thread.labels).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {thread.labels.severity && (
            <span className="rounded bg-[var(--accent-blue-dim)] px-2 py-0.5 text-[8px] font-medium text-[var(--accent-blue)]">
              {formatSeverityLabel(thread.labels.severity)}
            </span>
          )}
          {thread.labels.model && (
            <span className="rounded bg-[var(--bg-overlay)] px-2 py-0.5 text-[8px] font-medium text-[var(--text-secondary)]">
              {formatModelLabel(thread.labels.model)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffThreadNav — slim 240px right panel for quick thread navigation
// ---------------------------------------------------------------------------

export function DiffThreadNav({
  threads,
  activeThreadId,
  onThreadClick,
  outdatedThreadIds,
}: DiffThreadNavProps) {
  const resolveStatus = useResolveStatus();
  const resolvingIds = useMemo(() => {
    if (resolveStatus.state !== "resolving") return new Set<string>();
    const doneIds = new Set(resolveStatus.log.map((e) => e.threadId));
    return new Set(
      resolveStatus.threads.filter((t) => !doneIds.has(t.id)).map((t) => t.id),
    );
  }, [resolveStatus]);

  // Section collapse state for non-open sections
  const [resolvedCollapsed, setResolvedCollapsed] = useState(false);
  const [wontfixCollapsed, setWontfixCollapsed] = useState(false);
  const [outdatedCollapsed, setOutdatedCollapsed] = useState(false);

  const openThreads = useMemo(
    () => sortByUpdated(threads.filter((t) => t.status === "open")),
    [threads],
  );

  const resolvedThreads = useMemo(
    () =>
      sortByUpdated(
        threads.filter((t) => normalizeStatus(t.status) === "resolved"),
      ),
    [threads],
  );

  const wontfixThreads = useMemo(
    () => sortByUpdated(threads.filter((t) => t.status === "wontfix")),
    [threads],
  );

  const outdatedThreads = useMemo(
    () =>
      sortByUpdated(
        threads.filter(
          (t) =>
            t.status === "outdated" ||
            (outdatedThreadIds?.has(t.id) && t.status === "open"),
        ),
      ),
    [threads, outdatedThreadIds],
  );

  const threadHeader = (
    <div className="flex items-center gap-1.5 border-b border-[var(--border-default)] px-3 pb-2 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        Threads
      </p>
      <KeyboardHint label="j k" />
    </div>
  );

  if (threads.length === 0) {
    // Minimal collapsed state: just an icon strip
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-l border-[var(--border-default)] bg-[var(--bg-surface)] pt-3">
        <MessageSquareIcon size={16} className="text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]">
      {threadHeader}

      <div className="flex-1 overflow-y-auto">
        {/* Open section — always visible */}
        <SectionLabel
          label="Open"
          count={openThreads.length}
          variant="open"
          sticky={false}
        />
        {openThreads.length === 0 ? (
          <p className="px-3 pb-3 text-[12px] text-[var(--text-muted)]">
            All threads resolved
          </p>
        ) : (
          openThreads.map((thread) => (
            <ThreadNavCard
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              isResolving={resolvingIds.has(thread.id)}
              onClick={() => onThreadClick(thread)}
            />
          ))
        )}

        {/* Resolved section */}
        {resolvedThreads.length > 0 && (
          <>
            <SectionLabel
              label="Resolved"
              count={resolvedThreads.length}
              variant="resolved"
              sticky={false}
              onClick={() => setResolvedCollapsed((v) => !v)}
              collapsed={resolvedCollapsed}
            />
            {!resolvedCollapsed &&
              resolvedThreads.map((thread) => (
                <ThreadNavCard
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  isResolving={false}
                  onClick={() => onThreadClick(thread)}
                />
              ))}
          </>
        )}

        {/* Won't Fix section */}
        {wontfixThreads.length > 0 && (
          <>
            <SectionLabel
              label="Won't Fix"
              count={wontfixThreads.length}
              variant="wontfix"
              sticky={false}
              onClick={() => setWontfixCollapsed((v) => !v)}
              collapsed={wontfixCollapsed}
            />
            {!wontfixCollapsed &&
              wontfixThreads.map((thread) => (
                <ThreadNavCard
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  isResolving={false}
                  onClick={() => onThreadClick(thread)}
                />
              ))}
          </>
        )}

        {/* Outdated section */}
        {outdatedThreads.length > 0 && (
          <>
            <SectionLabel
              label="Outdated"
              count={outdatedThreads.length}
              variant="outdated"
              sticky={false}
              onClick={() => setOutdatedCollapsed((v) => !v)}
              collapsed={outdatedCollapsed}
            />
            {!outdatedCollapsed &&
              outdatedThreads.map((thread) => (
                <ThreadNavCard
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  isResolving={false}
                  onClick={() => onThreadClick(thread)}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
