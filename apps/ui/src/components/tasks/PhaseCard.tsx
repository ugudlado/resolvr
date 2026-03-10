import { useState } from "react";
import type { Phase, Task, TaskStatus } from "../../types/sessions";

export interface PhaseCardProps {
  phase: Phase;
}

const statusConfig: Record<TaskStatus, { icon: string; className: string }> = {
  pending: { icon: "\u25CB", className: "text-slate-500" },
  in_progress: { icon: "\u25C9", className: "text-blue-400 animate-pulse" },
  done: { icon: "\u25CF", className: "text-green-400" },
  skipped: { icon: "\u25CC", className: "text-yellow-400" },
};

function TaskRow({ task }: { task: Task }) {
  const { icon, className } = statusConfig[task.status];
  const hasDetails = task.why ?? task.files ?? task.doneWhen;
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className={`group flex items-start gap-2 rounded px-3 py-1.5 transition-colors hover:bg-slate-700/30 ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={hasDetails ? () => setExpanded((prev) => !prev) : undefined}
      >
        {/* Status icon */}
        <span
          className={`shrink-0 font-mono text-sm leading-6 ${className}`}
          aria-label={task.status}
        >
          {icon}
        </span>

        {/* Task ID */}
        <span className="w-10 shrink-0 font-mono text-xs leading-6 text-slate-400">
          {task.id}
        </span>

        {/* Description + badges */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-sm leading-6 text-slate-200">
            {task.description}
          </span>

          {/* Dependency badges */}
          {task.dependencies.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
              depends: {task.dependencies.join(", ")}
            </span>
          )}

          {/* Parallelizable badge */}
          {task.parallelizable && (
            <span className="inline-flex items-center rounded-full bg-indigo-900 px-2 py-0.5 text-xs text-indigo-300">
              P
            </span>
          )}

          {/* Expand indicator */}
          {hasDetails && (
            <span className="text-[10px] text-slate-600 group-hover:text-slate-400">
              {expanded ? "▾" : "▸"}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="mb-2 ml-[4.5rem] space-y-1 rounded border-l-2 border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
          {task.why && (
            <div>
              <span className="font-medium text-slate-300">Why: </span>
              {task.why}
            </div>
          )}
          {task.files && (
            <div>
              <span className="font-medium text-slate-300">Files: </span>
              <span className="font-mono text-[11px]">{task.files}</span>
            </div>
          )}
          {task.doneWhen && (
            <div>
              <span className="font-medium text-slate-300">Done when: </span>
              {task.doneWhen}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PhaseCard({ phase }: PhaseCardProps) {
  const label = phase.name;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">{label}</h3>
          <span className="text-xs text-slate-400">
            {Math.round(phase.progress)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${phase.progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="py-1">
        {phase.tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
