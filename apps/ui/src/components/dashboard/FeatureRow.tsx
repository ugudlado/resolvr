import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { FeatureInfo } from "../../services/featureApi";
import { relativeTime } from "../../utils/timeFormat";
import { FLAGS } from "../../config/app";
import { FEATURE_STATUS, type FeatureStatus } from "../../types/sessions";
import { useRepoContext, withRepo } from "../../hooks/useRepoContext";

export interface FeatureRowProps {
  feature: FeatureInfo;
  searchQuery?: string;
  repoName?: string | null;
  /** Render in compact mode for completed features list */
  compact?: boolean;
}

const ROW_ACCENT: Record<FeatureStatus, string> = {
  new: "border-l-slate-700",
  design: "border-l-purple-500",
  design_review: "border-l-amber-400",
  code: "border-l-blue-400",
  code_review: "border-l-amber-400",
  complete: "border-l-transparent",
};

function GitBranchIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0 text-slate-500"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
    </svg>
  );
}

function ThreadIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
    </svg>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-blue-500/20 not-italic text-blue-300">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const KNOWN_ACRONYMS = new Set([
  "ui",
  "api",
  "css",
  "pr",
  "ci",
  "cd",
  "cli",
  "url",
  "http",
  "id",
  "tdd",
  "sdk",
]);
const LOWERCASE_WORDS = new Set([
  "and",
  "or",
  "of",
  "the",
  "in",
  "for",
  "to",
  "a",
  "an",
  "at",
  "by",
  "with",
  "from",
  "on",
  "only",
]);

function formatFeatureTitle(id: string): string {
  const withoutDate = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const words = withoutDate.split("-");
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      // Always capitalize first and last word
      if (i === 0 || i === words.length - 1) {
        return KNOWN_ACRONYMS.has(lower)
          ? w.toUpperCase()
          : w.charAt(0).toUpperCase() + w.slice(1);
      }
      // Lowercase small words in the middle
      if (LOWERCASE_WORDS.has(lower)) return lower;
      // Uppercase known acronyms
      if (KNOWN_ACRONYMS.has(lower)) return w.toUpperCase();
      // Default title case
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Status pill styles: each status has a distinct colored background + matching text */
const STATUS_PILL: Record<
  FeatureStatus,
  { bg: string; text: string; label: string }
> = {
  new: {
    bg: "bg-slate-500/20",
    text: "text-slate-300",
    label: "New",
  },
  design: {
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    label: "Design",
  },
  design_review: {
    bg: "bg-amber-400/20",
    text: "text-amber-300",
    label: "Design Review",
  },
  code: {
    bg: "bg-blue-500/20",
    text: "text-blue-300",
    label: "Code",
  },
  code_review: {
    bg: "bg-amber-400/20",
    text: "text-amber-300",
    label: "Code Review",
  },
  complete: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    label: "Complete",
  },
};

function StatusPill({ status }: { status: FeatureStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <div>
      <Badge
        variant="secondary"
        className={`cursor-default rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${pill.bg} ${pill.text}`}
        style={{ pointerEvents: "none" }}
      >
        {pill.label}
      </Badge>
    </div>
  );
}

export default function FeatureRow({
  feature,
  searchQuery = "",
  repoName,
  compact = false,
}: FeatureRowProps) {
  const navigate = useNavigate();
  const { repo, workspace } = useRepoContext();
  const { done, total } = feature.taskProgress;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalOpen =
    feature.codeThreadCounts.open + feature.specThreadCounts.open;
  const totalResolved =
    feature.codeThreadCounts.resolved + feature.specThreadCounts.resolved;
  const isComplete = feature.status === FEATURE_STATUS.Complete;
  const accentClass = ROW_ACCENT[feature.status] ?? "border-l-slate-600";

  function handleActivate() {
    void navigate(withRepo(`/features/${feature.id}`, repo, workspace));
  }

  // Compact layout for completed features — single line, no grid, no status pill
  if (compact && isComplete) {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
        className="hover:bg-[var(--bg-surface)]/50 group flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-slate-500 transition-colors hover:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
      >
        <svg
          className="h-3 w-3 shrink-0 text-emerald-600"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
        <span className="truncate text-xs">
          {highlightMatch(formatFeatureTitle(feature.id), searchQuery)}
        </span>
        {!workspace && repoName && (
          <span className="shrink-0 rounded bg-slate-700/40 px-1 py-0.5 text-[9px] text-slate-600">
            {repoName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate();
      }}
      className={`grid cursor-pointer items-center gap-6 rounded-lg border border-l-[3px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] ${accentClass} border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-3.5 hover:translate-x-1 hover:border-slate-600 hover:bg-[var(--canvas-elevated)]`}
      style={{ gridTemplateColumns: "2fr 1fr 1.5fr 1.2fr auto" }}
    >
      {/* Col 1: Title + Branch + Workspace */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">
            {highlightMatch(formatFeatureTitle(feature.id), searchQuery)}
          </span>
          {!workspace && repoName && (
            <span className="shrink-0 rounded bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
              {repoName}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <GitBranchIcon />
          <span className="truncate text-[11px] text-slate-500">
            {feature.branch}
          </span>
        </div>
      </div>

      {/* Col 2: Status pill */}
      {FLAGS.DEV_WORKFLOW ? <StatusPill status={feature.status} /> : <div />}

      {/* Col 3: Metrics — threads + files (hide when both are zero) */}
      <div className="flex flex-col gap-1.5 text-[12px]">
        {totalOpen > 0 || totalResolved > 0 ? (
          <div
            className={`flex items-center gap-1.5 ${
              totalOpen > 0
                ? "font-medium text-amber-400"
                : "text-[var(--accent-emerald)]"
            }`}
          >
            {totalOpen === 0 && totalResolved > 0 ? (
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
            ) : (
              <ThreadIcon />
            )}
            <span>
              {totalOpen > 0 ? `${totalOpen} open threads` : "All resolved"}
            </span>
          </div>
        ) : null}
        {feature.filesChanged > 0 ? (
          <div className="flex items-center gap-1.5 text-slate-600">
            <FileIcon />
            <span>{feature.filesChanged} files</span>
          </div>
        ) : null}
      </div>

      {/* Col 4: Progress bar (hidden when complete or total === 0) */}
      {FLAGS.DEV_WORKFLOW && total > 0 && !isComplete ? (
        <div className="min-w-0">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--ink-ghost,#2d3748)]">
            <div
              className={`h-full rounded-full transition-all ${progressPct === 100 ? "bg-[var(--accent-emerald,#10b981)]" : "bg-[var(--accent-blue,#3b82f6)]"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--ink-faint,#6b7280)]">
            {done}/{total} Tasks
          </div>
        </div>
      ) : (
        <div />
      )}

      {/* Col 5: Relative time (only when activity exists) */}
      <div className="text-right font-mono text-[11px] tabular-nums text-[var(--ink-faint,#6b7280)]">
        {feature.lastActivity ? relativeTime(feature.lastActivity) : null}
      </div>
    </div>
  );
}
