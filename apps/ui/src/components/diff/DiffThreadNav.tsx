import { useMemo } from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import type { ThreadSeverity } from "../../types/sessions";
import { relativeTime } from "../../utils/timeFormat";
import { shortPath, lineLabel } from "../../utils/diffUtils";
import { useResolveStatus } from "../../hooks/useResolveStatus";
import { KeyboardHint } from "../shared/KeyboardHint";

/** Extended thread with optional severity (may come from adapted threads). */
type ThreadWithSeverity = ReviewThread & {
  severity?: ThreadSeverity;
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
        {isResolving ? (
          <span className="bg-[var(--accent-blue)]/15 shrink-0 rounded px-1 py-0.5 text-[9px] text-[var(--accent-blue)]">
            resolving…
          </span>
        ) : showBadge ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${badgeClasses}`}
          >
            {thread.severity}
          </span>
        ) : null}
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

function SectionLabel({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "open" | "resolved";
}) {
  const badgeColors =
    variant === "open"
      ? "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]"
      : "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
        {label}
      </span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeColors}`}
      >
        {count}
      </span>
    </div>
  );
}

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
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
        Threads
      </p>
      <KeyboardHint label="j k" />
    </div>
  );

  if (threads.length === 0) {
    return (
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--canvas-raised)]">
        {threadHeader}
        <p className="px-3 py-8 text-center text-[12px] text-[var(--ink-ghost)]">
          No threads yet
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--canvas-raised)]">
      {threadHeader}

      {/* Single scrollable list with Open / Resolved sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Open section */}
        <SectionLabel label="Open" count={openThreads.length} variant="open" />
        {openThreads.length === 0 ? (
          <p className="px-3 pb-3 text-[12px] text-[var(--ink-ghost)]">
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
