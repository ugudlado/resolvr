import { useNavigate } from "react-router-dom";
import { type FeatureInfo } from "../../services/featureApi";
import { relativeTime } from "../../utils/timeFormat";

export interface FeatureCardProps {
  feature: FeatureInfo;
  searchQuery?: string;
}

function GitBranchIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
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

const ACRONYMS = new Set([
  "ui",
  "ux",
  "api",
  "cli",
  "db",
  "pr",
  "css",
  "js",
  "ts",
  "http",
  "url",
  "id",
  "ai",
  "ci",
  "cd",
]);

function parseFeatureTitle(id: string): string {
  const withoutDate = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const withoutLinear = withoutDate.replace(/^[A-Z]+-\d+-/, "");
  return withoutLinear
    .split("-")
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function isBranchRedundant(branch: string, id: string): boolean {
  return branch === `feature/${id}` || branch === "main" || branch === "master";
}

function extractDateFromId(id: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})-/.exec(id);
  if (!match) return null;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[parseInt(match[2], 10) - 1];
  const day = parseInt(match[3], 10);
  return month && day ? `${month} ${day}` : null;
}

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> =
  {
    new: { bg: "bg-blue-500/20", text: "text-blue-300", label: "Active" },
    design: {
      bg: "bg-purple-400/10",
      text: "text-purple-400",
      label: "Design",
    },
    design_review: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      label: "Design Review",
    },
    code: { bg: "bg-blue-400/10", text: "text-blue-400", label: "Code" },
    code_review: {
      bg: "bg-amber-400/10",
      text: "text-amber-400",
      label: "Code Review",
    },
    complete: {
      bg: "bg-emerald-500/[0.08]",
      text: "text-emerald-400",
      label: "Complete",
    },
  };

export default function FeatureCard({
  feature,
  searchQuery = "",
}: FeatureCardProps) {
  const navigate = useNavigate();
  const parsedTitle = parseFeatureTitle(feature.id);
  const pill = STATUS_PILL[feature.status] ?? STATUS_PILL.new;
  const showBranch = !isBranchRedundant(feature.branch, feature.id);
  const isComplete = feature.status === "complete";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => void navigate(`/features/${feature.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          void navigate(`/features/${feature.id}`);
      }}
      className={
        isComplete
          ? "group flex cursor-pointer items-center gap-4 rounded-lg border border-l-4 border-[var(--border-default)] border-l-emerald-700 bg-[var(--bg-surface)] px-4 py-3 transition-all hover:bg-slate-800/50"
          : "group flex cursor-pointer items-center gap-4 rounded-lg border border-l-4 border-[var(--border-default)] border-l-blue-400 bg-[var(--bg-surface)] px-4 py-4 transition-all hover:bg-slate-800/50"
      }
    >
      {/* Title area */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={`truncate text-sm ${isComplete ? "font-normal text-zinc-400" : "font-semibold text-white"}`}
          >
            {highlightMatch(parsedTitle, searchQuery)}
          </div>
          {/* Status pill — inline with title */}
          {!isComplete && (
            <span
              className={`shrink-0 whitespace-nowrap rounded px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${feature.status === "design" ? "border border-violet-500/30 bg-violet-500/20 text-violet-300" : `${pill.bg} ${pill.text}`}`}
            >
              {pill.label}
            </span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-xs text-zinc-500">
          {highlightMatch(feature.id, searchQuery)}
        </div>
        {showBranch && (
          <div className="mt-1 flex items-center gap-1 text-slate-600">
            <GitBranchIcon />
            <span className="truncate text-[10px]">{feature.branch}</span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div
        className={`w-20 shrink-0 text-right text-[11px] tabular-nums ${isComplete ? "text-slate-600" : "text-slate-300"}`}
      >
        {feature.lastActivity
          ? relativeTime(feature.lastActivity)
          : (extractDateFromId(feature.id) ?? "—")}
      </div>

      {/* Chevron — hidden at rest, visible on hover */}
      <svg
        className="h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-slate-400"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </div>
  );
}
