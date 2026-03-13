import { useState } from "react";
import type { Task, TaskStatus } from "../../types/sessions";
import { fileName } from "../../utils/diffUtils";
import { DepChain } from "../shared/DepChain";

export interface TaskRowProps {
  task: Task;
  allTasks: Task[];
}

// ---------------------------------------------------------------------------
// Status icon rendering
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: TaskStatus }) {
  const base: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  switch (status) {
    case "done":
      return (
        <span
          style={{
            ...base,
            backgroundColor: "rgba(52,211,153,0.15)",
            color: "var(--accent-emerald)",
          }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5.5L4 7.5L8 3"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );

    case "in_progress":
      return (
        <span
          style={{
            ...base,
            backgroundColor: "rgba(96,165,250,0.15)",
            color: "var(--accent-blue)",
            animation: "pulse-glow 2s ease-in-out infinite",
          }}
        >
          <svg width={8} height={10} viewBox="0 0 8 10" fill="currentColor">
            <path d="M1 1v8l6-4z" />
          </svg>
        </span>
      );

    case "pending":
      return (
        <span
          style={{
            ...base,
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-muted)",
            border: "1.5px solid var(--text-muted)",
            boxSizing: "border-box",
          }}
        />
      );

    case "skipped":
      return (
        <span
          style={{
            ...base,
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-tertiary)",
          }}
        >
          <svg width={10} height={2} viewBox="0 0 10 2" fill="currentColor">
            <rect width={10} height={2} rx={1} />
          </svg>
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Tag components
// ---------------------------------------------------------------------------

const tagBase: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  borderRadius: 3,
  padding: "2px 7px",
  lineHeight: 1.4,
};

function DependencyTag({ id }: { id: string }) {
  return (
    <span
      style={{
        ...tagBase,
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-tertiary)",
      }}
    >
      {id}
    </span>
  );
}

function FileTag({ file }: { file: string }) {
  return (
    <span
      style={{
        ...tagBase,
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-secondary)",
      }}
    >
      {file}
    </span>
  );
}

function ParallelTag() {
  return (
    <span
      style={{
        ...tagBase,
        backgroundColor: "rgba(188,140,255,0.12)",
        color: "#bc8cff",
      }}
    >
      P
    </span>
  );
}

// ---------------------------------------------------------------------------
// Expanded details panel
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  // Highlight backtick-quoted code snippets
  const parts = value.split(/(`[^`]+`)/g);

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
          width: 60,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        {parts.map((part, i) =>
          part.startsWith("`") && part.endsWith("`") ? (
            <code
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--accent-blue)",
                padding: "1px 4px",
                borderRadius: 3,
                fontSize: 12,
              }}
            >
              {part.slice(1, -1)}
            </code>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build DepChain dots
// ---------------------------------------------------------------------------

function buildDepChainDots(task: Task, allTasks: Task[]) {
  type DotStatus = "done" | "current" | "pending";
  const dots: { id: string; status: DotStatus }[] = [];

  // Predecessor tasks (from dependencies)
  for (const depId of task.dependencies) {
    const dep = allTasks.find((t) => t.id === depId);
    dots.push({
      id: depId,
      status: dep?.status === "done" ? "done" : "pending",
    });
  }

  // Current task
  dots.push({ id: task.id, status: "current" });

  // Successor tasks (tasks that list this task in their dependencies)
  for (const t of allTasks) {
    if (t.dependencies.includes(task.id)) {
      dots.push({ id: t.id, status: "pending" });
    }
  }

  return dots;
}

// ---------------------------------------------------------------------------
// TaskRow component
// ---------------------------------------------------------------------------

export function TaskRow({ task, allTasks }: TaskRowProps) {
  const [expanded, setExpanded] = useState(task.status === "in_progress");
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";

  const hasDetails = task.why ?? task.files ?? task.doneWhen;
  const hasTags =
    task.dependencies.length > 0 || (task.files ?? task.parallelizable);

  // Parse filenames from the files string
  const fileNames = task.files
    ? task.files
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
        .map(fileName)
    : [];

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-muted)",
        cursor: "pointer",
      }}
      className="hover:bg-[rgba(96,165,250,0.03)]"
      onClick={() => setExpanded((e) => !e)}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 0",
          alignItems: "flex-start",
        }}
      >
        {/* Status icon */}
        <div style={{ paddingTop: 2 }}>
          <StatusIcon status={task.status} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "var(--text-tertiary)",
                flexShrink: 0,
              }}
            >
              {task.id}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.4,
              }}
            >
              {task.description}
            </span>
          </div>

          {/* Tags row */}
          {hasTags && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 6,
              }}
            >
              {task.dependencies.map((dep) => (
                <DependencyTag key={dep} id={dep} />
              ))}
              {fileNames.map((f) => (
                <FileTag key={f} file={f} />
              ))}
              {task.parallelizable && <ParallelTag />}
            </div>
          )}

          {/* DepChain for in-progress tasks */}
          {isInProgress && (
            <div style={{ marginTop: 8 }}>
              <DepChain dots={buildDepChainDots(task, allTasks)} />
            </div>
          )}

          {/* Expanded details panel */}
          {expanded && hasDetails && (
            <div
              style={{
                backgroundColor: "var(--bg-base)",
                border: "1px solid var(--border-muted)",
                borderRadius: 6,
                padding: "10px 14px",
                marginTop: 8,
              }}
            >
              {task.why && <DetailRow label="Why" value={task.why} />}
              {task.files && <DetailRow label="Files" value={task.files} />}
              {task.doneWhen && (
                <DetailRow label="Done" value={task.doneWhen} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
