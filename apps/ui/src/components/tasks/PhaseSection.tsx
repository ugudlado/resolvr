import { useState } from "react";
import type { Phase } from "../../types/sessions";
import { TaskRow } from "./TaskRow";

export interface PhaseSectionProps {
  phase: Phase;
}

export function PhaseSection({ phase }: PhaseSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const doneCount = phase.tasks.filter((t) => t.status === "done").length;
  const totalCount = phase.tasks.length;

  return (
    <div
      className="hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
      style={{
        backgroundColor: "var(--canvas-raised)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
    >
      {/* Header — clickable to collapse */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="hover:bg-[var(--canvas-elevated)]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          cursor: "pointer",
          transition: "background-color 0.15s ease",
        }}
      >
        {/* Chevron */}
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color: "var(--ink-faint)",
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
          style={{
            fontFamily: "'Newsreader', serif",
            fontSize: 16,
            fontWeight: 500,
            color: "var(--ink)",
            flex: 1,
          }}
        >
          {phase.name}
        </span>

        {/* Mini progress bar */}
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: "var(--border)",
            borderRadius: 2,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: `${phase.progress}%`,
              height: "100%",
              backgroundColor: "var(--accent-emerald)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Count */}
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "var(--ink-muted)",
            flexShrink: 0,
          }}
        >
          {doneCount}/{totalCount}
        </span>
      </div>

      {/* Body — task list */}
      {!collapsed && (
        <div style={{ padding: "0 18px 14px" }}>
          {phase.tasks.map((task) => (
            <TaskRow key={task.id} task={task} allTasks={phase.tasks} />
          ))}
        </div>
      )}
    </div>
  );
}
