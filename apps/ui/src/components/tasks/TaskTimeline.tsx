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
        padding: "32px 40px 80px",
      }}
    >
      {/* Progress header */}
      <div
        style={{
          borderBottom: "1px solid var(--border-muted)",
          paddingBottom: 12,
          marginBottom: 16,
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
              fontSize: 28,
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
        {/* Feature ID */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontFamily: "monospace",
            marginBottom: 6,
          }}
        >
          {featureId}
        </div>
        {/* Stats row */}
        <div className="mt-1 font-mono text-xs text-slate-400">
          {total} total ·{" "}
          <span className="font-semibold text-emerald-400">{completed}</span>{" "}
          <span className="text-emerald-400">done</span>
          {inProgress > 0 && (
            <>
              {" "}
              · <span className="text-blue-400">{inProgress}</span> in progress
            </>
          )}
          {remaining > 0 && <> · {remaining} remaining</>}
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

      {/* Status legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {(
          [
            {
              color: "var(--accent-emerald)",
              bg: "rgba(52,211,153,0.15)",
              icon: (
                <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5.5L4 7.5L8 3"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
              label: "Done",
            },
            {
              color: "var(--accent-blue)",
              bg: "rgba(96,165,250,0.15)",
              icon: (
                <svg
                  width={8}
                  height={10}
                  viewBox="0 0 8 10"
                  fill="currentColor"
                >
                  <path d="M1 1v8l6-4z" />
                </svg>
              ),
              label: "In progress",
            },
            {
              color: "var(--text-muted)",
              bg: "var(--bg-elevated)",
              icon: null,
              label: "Pending",
              border: "1.5px solid var(--text-muted)",
            },
            {
              color: "var(--text-tertiary)",
              bg: "var(--bg-elevated)",
              icon: (
                <svg
                  width={10}
                  height={2}
                  viewBox="0 0 10 2"
                  fill="currentColor"
                >
                  <rect width={10} height={2} rx={1} />
                </svg>
              ),
              label: "Skipped",
            },
          ] as Array<{
            color: string;
            bg: string;
            icon: React.ReactNode;
            label: string;
            border?: string;
          }>
        ).map(({ color, bg, icon, label, border }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: bg,
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border,
                boxSizing: "border-box",
              }}
            >
              {icon}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {label}
            </span>
          </div>
        ))}
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
