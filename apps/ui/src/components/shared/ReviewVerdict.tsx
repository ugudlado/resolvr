/**
 * ReviewVerdict — approve / request-changes toggle buttons.
 *
 * Pure presentational component. The caller owns the state machine that maps
 * verdict values to session status transitions:
 *
 *   SpecReview:  review -> approved  (verdict="approved")
 *                review -> draft     (verdict="changes_requested")
 *
 *   CodeReview:  review -> approved     (verdict="approved")
 *                review -> in-progress  (verdict="changes_requested")
 */

import { useResolveStatus } from "../../hooks/useResolveStatus";

export interface ReviewVerdictProps {
  verdict: "approved" | "changes_requested" | null;
  onVerdictChange: (verdict: "approved" | "changes_requested") => void;
  /** Number of unresolved threads. Shows a warning badge when approving. */
  openThreadCount: number;
  /** Disables both buttons (e.g. when session is not in "review" status). */
  disabled?: boolean;
  /** Feature ID used to match resolve status events to this session. */
  featureId?: string;
}

export function ReviewVerdict({
  verdict,
  onVerdictChange,
  openThreadCount,
  disabled = false,
  featureId,
}: ReviewVerdictProps) {
  const isApproved = verdict === "approved";
  const isChangesRequested = verdict === "changes_requested";
  const resolveStatus = useResolveStatus();

  // Only show status for this feature's resolve events
  const matchesFeature = (s: { featureId: string }) =>
    !featureId || s.featureId === featureId;
  const isResolving =
    resolveStatus.state === "resolving" && matchesFeature(resolveStatus);
  const justCompleted =
    resolveStatus.state === "completed" && matchesFeature(resolveStatus);
  const hasFailed =
    resolveStatus.state === "failed" && matchesFeature(resolveStatus);

  return (
    <div className="flex items-center gap-2">
      {/* Approve button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVerdictChange("approved")}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            : isApproved
              ? "bg-emerald-500/25 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
              : "bg-emerald-500/15 text-emerald-400"
        } `}
      >
        {isApproved && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
          </svg>
        )}
        {isApproved ? "Approved" : "Approve"}

        {/* Open thread warning badge */}
        {openThreadCount > 0 && !disabled && (
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold leading-none text-amber-400"
            title={`${openThreadCount} open thread${openThreadCount === 1 ? "" : "s"}`}
          >
            {openThreadCount}
          </span>
        )}
      </button>

      {/* Request Changes button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVerdictChange("changes_requested")}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            : isChangesRequested
              ? "bg-blue-500/25 text-blue-300 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]"
              : "bg-blue-500/15 text-blue-400"
        } `}
      >
        {isChangesRequested && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
        {isChangesRequested ? "Changes Requested" : "Request Changes"}
      </button>

      {/* Resolver status indicator */}
      {isResolving && (
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
          Resolving {resolveStatus.threadCount} thread
          {resolveStatus.threadCount === 1 ? "" : "s"}…
        </span>
      )}
      {justCompleted && (
        <span className="text-xs text-emerald-400">
          {resolveStatus.resolved} resolved
          {resolveStatus.clarifications > 0
            ? `, ${String(resolveStatus.clarifications)} need clarification`
            : ""}
        </span>
      )}
      {hasFailed && (
        <span className="text-xs text-red-400" title={resolveStatus.error}>
          Resolve failed
        </span>
      )}
    </div>
  );
}
