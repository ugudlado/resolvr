import { Link, useNavigate } from "react-router-dom";
import { SOURCE_TYPE, type FeatureInfo } from "../../services/featureApi";
import { getStatusConfig } from "../../utils/featureStatus";
import { FEATURE_STATUS } from "../../types/constants";
import { relativeTime } from "../../utils/timeFormat";
import PipelineDots from "./PipelineDots";
import { ThreadProgressRing } from "../shared/ThreadProgressRing";
import { FLAGS } from "../../config/app";

export interface FeatureCardProps {
  feature: FeatureInfo;
  searchQuery?: string;
}

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

interface ActionLinkProps {
  to: string;
  disabled: boolean;
  children: React.ReactNode;
}

function ActionLink({ to, disabled, children }: ActionLinkProps) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded px-2.5 py-1 text-xs font-medium text-slate-600">
        {children}
      </span>
    );
  }
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="rounded px-2.5 py-1 text-xs font-medium text-blue-400 transition hover:bg-slate-700/50"
    >
      {children}
    </Link>
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

const STATUS_ACCENT: Record<string, string> = {
  new: "group-hover:border-t-slate-500",
  design: "group-hover:border-t-purple-500",
  design_review: "group-hover:border-t-yellow-500",
  code: "group-hover:border-t-blue-500",
  code_review: "group-hover:border-t-yellow-500",
  complete: "group-hover:border-t-emerald-500",
};

export default function FeatureCard({
  feature,
  searchQuery = "",
}: FeatureCardProps) {
  const navigate = useNavigate();
  const statusConfig = getStatusConfig(feature.status);
  const { done, total } = feature.taskProgress;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  // Dashboard aggregates both sessions for the summary ring
  const totalOpen =
    feature.codeThreadCounts.open + feature.specThreadCounts.open;
  const totalResolved =
    feature.codeThreadCounts.resolved + feature.specThreadCounts.resolved;
  const hasOpenThreads = totalOpen > 0;
  const accentClass = STATUS_ACCENT[feature.status] ?? "";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => {
        void navigate(`/features/${feature.id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          void navigate(`/features/${feature.id}`);
      }}
      className={`group flex cursor-pointer flex-col gap-3.5 rounded-lg border border-t-2 border-slate-700/50 border-t-transparent bg-[var(--bg-surface)] p-4 transition-all hover:-translate-y-px hover:border-slate-600 hover:shadow-lg ${accentClass}`}
    >
      {/* Title + timestamp */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-mono text-[15px] font-semibold text-slate-100">
          {highlightMatch(feature.id, searchQuery)}
        </h3>
        <span className="shrink-0 text-xs text-slate-400">
          {relativeTime(feature.lastActivity)}
        </span>
      </div>

      {/* Status badge + branch */}
      <div className="flex min-w-0 items-center gap-2">
        {FLAGS.DEV_WORKFLOW && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConfig.color} ${statusConfig.bgColor}`}
          >
            {statusConfig.label}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-1">
          <GitBranchIcon />
          <span className="truncate text-xs text-slate-400">
            {feature.branch}
          </span>
        </div>
        {feature.sourceType === SOURCE_TYPE.Branch && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-700">
            branch
          </span>
        )}
      </div>

      {/* Task progress — only shown in full dev workflow */}
      {FLAGS.DEV_WORKFLOW && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tasks</span>
            <span className="font-mono text-xs text-slate-400">
              {done} / {total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/60">
            <div
              className={`h-full rounded-full transition-all ${progressPct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Metrics: threads, files, pipeline dots */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1 text-xs ${hasOpenThreads ? "text-yellow-400" : "text-slate-500"}`}
        >
          <ThreadProgressRing
            resolved={totalResolved}
            open={totalOpen}
            size={18}
            thickness={2.5}
          />
          <span>
            {totalOpen > 0
              ? `${totalOpen} open`
              : totalResolved > 0
                ? "all clear"
                : "0 threads"}
          </span>
        </div>
        {feature.filesChanged > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <FileIcon />
            <span>{feature.filesChanged} files</span>
          </div>
        )}
        {FLAGS.DEV_WORKFLOW && (
          <div className="ml-auto">
            <PipelineDots status={feature.status} />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-0.5 border-t border-slate-700/50 pt-2.5">
        {FLAGS.DEV_WORKFLOW && (
          <ActionLink
            to={`/features/${feature.id}/tasks`}
            disabled={!feature.hasTasks}
          >
            Tasks
          </ActionLink>
        )}
        {feature.status !== FEATURE_STATUS.Complete && (
          <ActionLink to={`/features/${feature.id}/code`} disabled={false}>
            Code
          </ActionLink>
        )}
      </div>
    </div>
  );
}
