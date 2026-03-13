import { useMemo } from "react";
import type { TaskProgress } from "../../types/sessions";
import { formatFeatureLabel } from "../../utils/formatFeatureLabel";
import { PhaseSection } from "./PhaseSection";

export interface TaskTimelineProps {
  taskProgress: TaskProgress;
}

export function TaskTimeline({ taskProgress }: TaskTimelineProps) {
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
  const remaining = total - completed - inProgress;
  // Strip the "YYYY-MM-DD — " prefix from the full label to get just the title
  const title = useMemo(() => {
    const label = formatFeatureLabel(featureId);
    return label.includes(" — ") ? label.split(" — ")[1] : label;
  }, [featureId]);

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "20px 40px 80px",
      }}
    >
      {/* Progress header */}
      <div
        style={{
          borderBottom: "1px solid var(--border-muted)",
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            flexDirection: "column",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <h1
            style={{
              fontFamily: "'Newsreader', serif",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </h1>
          {!isTDD && (
            <span className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Non-TDD
            </span>
          )}
        </div>
        {/* Stats + inline legend row */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="tabular-nums">{total} total</span>
          <span className="flex items-center gap-1.5">
            <svg
              width={10}
              height={10}
              viewBox="0 0 10 10"
              fill="none"
              className="text-emerald-400"
            >
              <path
                d="M2 5.5L4 7.5L8 3"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-emerald-400">{completed} done</span>
          </span>
          {inProgress > 0 && (
            <span className="flex items-center gap-1.5">
              <svg
                width={8}
                height={10}
                viewBox="0 0 8 10"
                fill="currentColor"
                className="text-blue-400"
              >
                <path d="M1 1v8l6-4z" />
              </svg>
              <span className="text-blue-400">{inProgress} in progress</span>
            </span>
          )}
          {remaining > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--text-muted)]" />
              <span>{remaining} pending</span>
            </span>
          )}
        </div>
        {/* Thin progress bar */}
        <div
          style={{
            height: 3,
            backgroundColor: "var(--border-default)",
            borderRadius: 2,
            overflow: "hidden",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          <div
            style={{
              width: `${overallProgress}%`,
              height: "100%",
              backgroundColor:
                overallProgress === 100
                  ? "var(--accent-emerald)"
                  : "var(--accent-blue)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Phase sections */}
      {phases
        .filter((p) => !p.name.startsWith("Development Mode"))
        .map((phase) => (
          <PhaseSection key={phase.name} phase={phase} />
        ))}
    </div>
  );
}
