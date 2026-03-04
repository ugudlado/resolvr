import { Link, useNavigate } from "react-router-dom";
import type { FeatureInfo } from "../../services/featureApi";
import { getStatusConfig } from "../../utils/featureStatus";
import type { FeatureStatus } from "../../types/sessions";
import PipelineProgress from "./PipelineProgress";

export interface FeatureCardProps {
  feature: FeatureInfo;
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
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
      <span className="cursor-not-allowed rounded px-2 py-1 text-xs font-medium text-slate-600">
        {children}
      </span>
    );
  }
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="rounded px-2 py-1 text-xs font-medium text-blue-400 transition hover:bg-slate-700/50"
    >
      {children}
    </Link>
  );
}

/**
 * Dashboard card showing a feature summary with pipeline progress and quick action links.
 */
export default function FeatureCard({ feature }: FeatureCardProps) {
  const navigate = useNavigate();
  const status = feature.status as FeatureStatus;
  const statusConfig = getStatusConfig(status);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/features/${feature.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          navigate(`/features/${feature.id}`);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-700/50 bg-[var(--bg-surface)] p-4 transition hover:border-slate-600"
    >
      {/* Header: Feature ID + Status + Branch */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 truncate font-mono text-lg text-slate-100">
            {feature.id}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConfig.color} ${statusConfig.bgColor}`}
          >
            {statusConfig.label}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranchIcon className="shrink-0 text-slate-500" />
          <span className="truncate text-xs text-slate-400">
            {feature.branch}
          </span>
        </div>
      </div>

      {/* Pipeline Progress */}
      <PipelineProgress status={feature.status as FeatureStatus} />

      {/* Quick Actions */}
      <div className="flex items-center gap-1 border-t border-slate-700/50 pt-2">
        <ActionLink
          to={`/features/${feature.id}/spec`}
          disabled={!feature.hasSpec}
        >
          Spec
        </ActionLink>
        <ActionLink
          to={`/features/${feature.id}/tasks`}
          disabled={!feature.hasTasks}
        >
          Tasks
        </ActionLink>
        <ActionLink to={`/features/${feature.id}/code`} disabled={false}>
          Code
        </ActionLink>
      </div>
    </div>
  );
}
