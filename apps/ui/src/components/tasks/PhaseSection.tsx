import { useState } from "react";
import type { Phase } from "../../types/sessions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TaskRow } from "./TaskRow";

export interface PhaseSectionProps {
  phase: Phase;
}

export function PhaseSection({ phase }: PhaseSectionProps) {
  // Auto-expand phases when 100% complete to avoid empty page
  const [collapsed, setCollapsed] = useState(false);

  const doneCount = phase.tasks.filter((t) => t.status === "done").length;
  const totalCount = phase.tasks.length;
  const inProgress = phase.tasks.filter(
    (t) => t.status === "in_progress",
  ).length;

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className="hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
      style={{
        backgroundColor: "var(--bg-base)",
        borderLeft:
          doneCount === totalCount
            ? "3px solid var(--accent-emerald)"
            : inProgress > 0
              ? "3px solid var(--accent-blue)"
              : "3px solid var(--border-default)",
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
    >
      {/* Header — clickable to collapse */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full rounded-sm border-l-4 border-emerald-500 bg-zinc-800/40 px-3 py-2 text-left hover:bg-[var(--bg-elevated)]"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            transition: "background-color 0.15s ease",
            borderBottom: "1px solid var(--border-muted)",
          }}
        >
          {/* Chevron */}
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            style={{
              color: "var(--text-tertiary)",
              transition: "transform 0.2s ease",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Phase name */}
          <span
            className="text-sm font-semibold uppercase tracking-wide text-slate-200"
            style={{
              flex: 1,
            }}
          >
            {phase.name}
          </span>

          {/* Count */}
          <span
            className={`rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs ${doneCount === totalCount ? "text-emerald-400" : "text-zinc-400"}`}
            style={{
              flexShrink: 0,
            }}
          >
            {doneCount}/{totalCount}
          </span>
        </button>
      </CollapsibleTrigger>

      {/* Body — task list */}
      <CollapsibleContent className="overflow-hidden transition-all">
        <div style={{ padding: "0 18px 14px" }}>
          {phase.tasks.map((task) => (
            <TaskRow key={task.id} task={task} allTasks={phase.tasks} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
