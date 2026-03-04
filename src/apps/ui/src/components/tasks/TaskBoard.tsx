import type { TaskProgress } from "../../types/sessions";
import { PhaseCard } from "./PhaseCard";

export interface TaskBoardProps {
  taskProgress: TaskProgress;
}

export function TaskBoard({ taskProgress }: TaskBoardProps) {
  const {
    featureId,
    developmentMode,
    total,
    completed,
    inProgress,
    phases,
    overallProgress,
  } = taskProgress;

  const isTDD = developmentMode === "TDD";

  return (
    <div className="w-full bg-[var(--bg-base)] p-6">
      {/* Overall progress header */}
      <div className="mb-6 rounded-lg border border-slate-700/50 bg-[var(--bg-surface)] p-5">
        {/* Top row: feature ID + mode badge */}
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{featureId}</h2>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              isTDD
                ? "border-green-500/40 text-green-400"
                : "border-blue-500/40 text-blue-400"
            }`}
          >
            {developmentMode}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-mono text-sm text-slate-300">
              {completed}/{total} tasks complete
            </span>
            <span className="font-mono text-sm font-medium text-slate-200">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-700/60">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 text-xs text-slate-400">
          <div>
            <span className="text-slate-500">Total </span>
            <span className="font-mono text-slate-300">{total}</span>
          </div>
          <div>
            <span className="text-slate-500">Done </span>
            <span className="font-mono text-green-400">{completed}</span>
          </div>
          <div>
            <span className="text-slate-500">In Progress </span>
            <span className="font-mono text-blue-400">{inProgress}</span>
          </div>
          <div>
            <span className="text-slate-500">Remaining </span>
            <span className="font-mono text-slate-300">
              {total - completed - inProgress}
            </span>
          </div>
        </div>
      </div>

      {/* Phase cards */}
      <div className="flex flex-col gap-4">
        {phases.map((phase) => (
          <PhaseCard key={phase.name} phase={phase} />
        ))}
      </div>
    </div>
  );
}
