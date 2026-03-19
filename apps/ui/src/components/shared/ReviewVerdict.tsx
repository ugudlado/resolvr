/**
 * ReviewVerdict — request-changes button with resolve status display.
 *
 * Pure presentational component. The caller owns the state machine that maps
 * verdict values to session status transitions.
 */

import { useEffect, useRef, useState } from "react";
import {
  useResolveStatus,
  type ThreadLogEntry,
  type ThreadInfo,
} from "../../hooks/useResolveStatus";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// ResolveRunLog — scrollable log of per-thread resolve outcomes
// ---------------------------------------------------------------------------

function ResolveRunLog({
  log,
  threads,
}: {
  log: ThreadLogEntry[];
  threads: ThreadInfo[];
}) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  const doneIds = new Set(log.map((e) => e.threadId));
  const pending = threads.filter((t) => !doneIds.has(t.id));

  const outcomeIcon: Record<string, string> = {
    resolved: "\u2713",
    clarification: "?",
    error: "\u2717",
  };
  const outcomeColor: Record<string, string> = {
    resolved: "text-emerald-400",
    clarification: "text-amber-400",
    error: "text-red-400",
  };

  return (
    <div className="mt-1.5 max-h-32 overflow-y-auto rounded-md bg-[var(--bg-base)] p-2 ring-1 ring-[var(--border-muted)]">
      {log.map((entry) => (
        <div
          key={entry.threadId}
          className="flex items-center gap-2 py-0.5 font-mono text-[10px]"
        >
          <span className={outcomeColor[entry.outcome]}>
            {outcomeIcon[entry.outcome]}
          </span>
          <span className="text-[var(--text-secondary)]">{entry.filePath}</span>
          <span className="text-[var(--text-muted)]">L{entry.line}</span>
          <span className={`ml-auto ${outcomeColor[entry.outcome]}`}>
            {entry.outcome === "clarification"
              ? "needs clarification"
              : entry.outcome}
          </span>
        </div>
      ))}
      {pending.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
        >
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--text-muted)]" />
          <span>{t.filePath}</span>
          <span>L{t.line}</span>
          <span className="ml-auto">waiting...</span>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
}

export interface ReviewVerdictProps {
  verdict: "changes_requested" | null;
  onVerdictChange: (verdict: "changes_requested") => void;
  /** Number of unresolved threads. */
  openThreadCount: number;
  /** Disables the button (e.g. when session is not in "review" status). */
  disabled?: boolean;
  /** Feature ID used to match resolve status events to this session. */
  featureId?: string;
  /** Callback to re-trigger thread resolution (retry after failure or re-resolve open threads). */
  onRetryResolve?: () => void;
}

export function ReviewVerdict({
  verdict,
  onVerdictChange,
  openThreadCount,
  disabled = false,
  featureId,
  onRetryResolve,
}: ReviewVerdictProps) {
  const isChangesRequested = verdict === "changes_requested";
  const resolveStatus = useResolveStatus();
  const [showLog, setShowLog] = useState(false);

  // Only show status for this feature's resolve events
  const matchesFeature = (s: { featureId: string }) =>
    !featureId || s.featureId === featureId;
  const isResolving =
    resolveStatus.state === "resolving" && matchesFeature(resolveStatus);
  const justCompleted =
    resolveStatus.state === "completed" && matchesFeature(resolveStatus);
  const hasFailed =
    resolveStatus.state === "failed" && matchesFeature(resolveStatus);

  let requestChangesClass: string;
  if (disabled) {
    requestChangesClass =
      "cursor-not-allowed bg-[var(--bg-elevated)] text-[var(--text-muted)]";
  } else if (isChangesRequested) {
    requestChangesClass =
      "bg-blue-500/25 text-blue-300 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]";
  } else {
    requestChangesClass = "bg-blue-500/15 text-blue-400";
  }

  return (
    <div className="flex items-center gap-2">
      {/* Request Changes button */}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => onVerdictChange("changes_requested")}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${requestChangesClass} `}
      >
        {isChangesRequested && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
        {isChangesRequested ? "Changes Requested" : "Request Changes"}
      </Button>

      {/* Resolver status indicator */}
      {isResolving && resolveStatus.state === "resolving" && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <svg
              className="h-3 w-3 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v3m0 12v3M3 12h3m12 0h3M6.34 6.34l2.12 2.12m7.08 7.08 2.12 2.12M6.34 17.66l2.12-2.12m7.08-7.08 2.12-2.12"
              />
            </svg>
            Resolving {resolveStatus.resolved}/{resolveStatus.threadCount}
          </span>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-overlay)]">
            <div
              className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-500"
              style={{
                width: `${resolveStatus.threadCount > 0 ? (resolveStatus.resolved / resolveStatus.threadCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
      {justCompleted && resolveStatus.state === "completed" && (
        <span className="text-xs text-emerald-400">
          {resolveStatus.resolved} resolved
          {resolveStatus.clarifications > 0
            ? `, ${String(resolveStatus.clarifications)} need clarification`
            : ""}
          {resolveStatus.log.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => setShowLog((prev) => !prev)}
              className="ml-1.5 h-auto p-0 text-[var(--text-muted)] underline decoration-dotted hover:text-[var(--text-secondary)]"
            >
              {showLog ? "hide log" : "show log"}
            </Button>
          )}
        </span>
      )}
      {hasFailed && (
        <span className="flex items-center gap-1.5 text-xs text-red-400">
          <span title={resolveStatus.error}>Resolve failed</span>
          {onRetryResolve && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onRetryResolve}
              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-500/25"
            >
              Retry
            </Button>
          )}
        </span>
      )}
      {/* Re-resolve button: shown when idle with open threads and verdict is changes_requested */}
      {!isResolving &&
        !justCompleted &&
        !hasFailed &&
        verdict === "changes_requested" &&
        openThreadCount > 0 &&
        onRetryResolve && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onRetryResolve}
            className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/25"
            title={`Re-resolve ${openThreadCount} open thread${openThreadCount === 1 ? "" : "s"}`}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 1 1-1.489.178A5.5 5.5 0 0 0 8 2.5Z" />
            </svg>
            Resolve {openThreadCount} thread{openThreadCount === 1 ? "" : "s"}
          </Button>
        )}
      {(showLog ||
        (isResolving &&
          resolveStatus.state === "resolving" &&
          resolveStatus.log.length > 0)) && (
        <ResolveRunLog
          log={
            resolveStatus.state === "resolving" ||
            resolveStatus.state === "completed"
              ? resolveStatus.log
              : []
          }
          threads={
            resolveStatus.state === "resolving" ? resolveStatus.threads : []
          }
        />
      )}
    </div>
  );
}
