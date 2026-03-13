import { useMemo } from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import { THREAD_SEVERITY } from "../../types/sessions";
import { relativeTime } from "../../utils/timeFormat";
import { shortPath, lineLabel } from "../../utils/diffUtils";
import { useResolveStatus } from "../../hooks/useResolveStatus";
import { KeyboardHint } from "../shared/KeyboardHint";
import { SectionLabel } from "../shared/SectionLabel";

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

  // Status dot color
  let dotColor: string;
  if (isResolving) {
    dotColor = "text-[var(--accent-blue)] animate-pulse";
  } else if (thread.status === "resolved" || thread.status === "approved") {
    dotColor = "text-[var(--accent-emerald)]";
  } else if (thread.severity === THREAD_SEVERITY.Critical) {
    dotColor = "text-[var(--accent-rose)]";
  } else {
    dotColor = "text-[var(--accent-blue)]";
  }

  // Severity badge — show for all severities except default (improvement)
  const showBadge =
    thread.status !== "resolved" &&
    thread.status !== "approved" &&
    thread.severity !== undefined &&
    thread.severity !== null &&
    thread.severity !== THREAD_SEVERITY.Improvement;

  const severityBadgeClasses: Record<string, string> = {
    [THREAD_SEVERITY.Critical]:
      "bg-[var(--accent-rose)]/15 text-[var(--accent-rose)]",
    [THREAD_SEVERITY.Style]:
      "bg-[var(--bg-overlay)] text-[var(--text-secondary)]",
    [THREAD_SEVERITY.Question]:
      "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]",
  };
  const badgeClasses =
    severityBadgeClasses[thread.severity ?? ""] ??
    "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]";

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer px-3 py-2 transition-colors hover:bg-[var(--bg-elevated)] ${
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
        {isResolving && (
          <span className="bg-[var(--accent-blue)]/15 shrink-0 rounded px-1 py-0.5 text-[9px] text-[var(--accent-blue)]">
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

      {/* Row 3: author + time */}
      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
        {author}
        {author && " \u00B7 "}
        {time}
      </p>

      {/* Row 4: analytics labels for resolved threads */}
      {(thread.status === "resolved" || thread.status === "approved") &&
        thread.labels &&
        Object.keys(thread.labels).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {thread.labels.severity && (
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[8px] font-medium text-blue-300">
                {formatSeverityLabel(thread.labels.severity)}
              </span>
            )}
            {thread.labels.model && (
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[8px] font-medium text-indigo-300">
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
}: DiffThreadNavProps) {
  const resolveStatus = useResolveStatus();
  const resolvingIds = useMemo(() => {
    if (resolveStatus.state !== "resolving") return new Set<string>();
    const doneIds = new Set(resolveStatus.log.map((e) => e.threadId));
    return new Set(
      resolveStatus.threads.filter((t) => !doneIds.has(t.id)).map((t) => t.id),
    );
  }, [resolveStatus]);

  const openThreads = useMemo(
    () =>
      [...threads.filter((t) => t.status === "open")].sort(
        (a, b) =>
          new Date(b.lastUpdatedAt).getTime() -
          new Date(a.lastUpdatedAt).getTime(),
      ),
    [threads],
  );

  const resolvedThreads = useMemo(
    () =>
      [
        ...threads.filter(
          (t) => t.status === "resolved" || t.status === "approved",
        ),
      ].sort(
        (a, b) =>
          new Date(b.lastUpdatedAt).getTime() -
          new Date(a.lastUpdatedAt).getTime(),
      ),
    [threads],
  );

  const threadHeader = (
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Threads
      </p>
      <KeyboardHint label="j k" />
    </div>
  );

  if (threads.length === 0) {
    // Minimal collapsed state: just an icon strip
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-l border-[var(--border-default)] bg-[var(--bg-surface)] pt-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-4 w-4 text-[var(--text-muted)]"
        >
          <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 13H8.061l-2.574 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25v-8.5C0 1.784.784 1 1.75 1Z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]">
      {threadHeader}

      {/* Single scrollable list with Open / Resolved sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Open section */}
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
            />
            {resolvedThreads.map((thread) => (
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
