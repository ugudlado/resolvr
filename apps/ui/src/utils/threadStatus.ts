import { THREAD_STATUS, type ThreadStatus } from "../types/constants";

/** Normalize legacy "approved" status to "resolved". */
export function normalizeStatus(status: ThreadStatus): ThreadStatus {
  if (status === THREAD_STATUS.Approved) return THREAD_STATUS.Resolved;
  return status;
}

/** Returns true if the thread is in any non-open (closed) state. */
export function isClosed(status: ThreadStatus): boolean {
  const s = normalizeStatus(status);
  return s !== THREAD_STATUS.Open;
}

/** CSS variable color tokens per status — single source of truth for all status styling. */
export const STATUS_COLORS: Record<
  string,
  { dot: string; bg: string; text: string }
> = {
  [THREAD_STATUS.Open]: {
    dot: "var(--accent-amber)",
    bg: "var(--accent-amber-dim)",
    text: "var(--accent-amber)",
  },
  [THREAD_STATUS.Resolved]: {
    dot: "var(--accent-emerald)",
    bg: "var(--accent-emerald-dim)",
    text: "var(--accent-emerald)",
  },
  [THREAD_STATUS.WontFix]: {
    dot: "var(--text-muted)",
    bg: "var(--bg-overlay)",
    text: "var(--text-secondary)",
  },
  [THREAD_STATUS.Outdated]: {
    dot: "var(--accent-purple)",
    bg: "var(--accent-purple-dim)",
    text: "var(--accent-purple)",
  },
};

/** Human-readable label for a thread status. */
export function statusLabel(status: ThreadStatus): string {
  const s = normalizeStatus(status);
  switch (s) {
    case THREAD_STATUS.Open:
      return "Open";
    case THREAD_STATUS.Resolved:
      return "Resolved";
    case THREAD_STATUS.WontFix:
      return "Won't Fix";
    case THREAD_STATUS.Outdated:
      return "Outdated";
    default:
      return "Open";
  }
}
