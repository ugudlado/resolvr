import type { TaskProgress } from "../../types/sessions";
import { ProgressRing } from "../shared/ProgressRing";
import { PhaseSection } from "./PhaseSection";

export interface TaskTimelineProps {
  taskProgress: TaskProgress;
}

/**
 * Derive a human-readable title from a featureId.
 * Strips the date prefix (first 11 chars: "YYYY-MM-DD-"),
 * replaces hyphens with spaces, and title-cases each word.
 */
function deriveTitle(featureId: string): string {
  const slug = featureId.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  const title = deriveTitle(featureId);

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
          display: "flex",
          gap: 24,
          marginBottom: 32,
          alignItems: "flex-start",
        }}
      >
        {/* Left: ring */}
        <ProgressRing percentage={overallProgress} />

        {/* Right: info */}
        <div style={{ flex: 1 }}>
          {/* Title */}
          <div
            style={{
              fontFamily: "'Newsreader', serif",
              fontSize: 22,
              fontWeight: 500,
              color: "var(--ink)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>

          {/* Subtitle: full featureId */}
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              marginTop: 2,
            }}
          >
            {featureId}
          </div>

          {/* Mode badge */}
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 4,
              marginTop: 6,
              backgroundColor: isTDD
                ? "rgba(52,211,153,0.12)"
                : "rgba(96,165,250,0.12)",
              color: isTDD ? "var(--accent-emerald)" : "var(--accent-blue)",
              boxShadow: isTDD
                ? "inset 0 0 0 1px rgba(52,211,153,0.2)"
                : "inset 0 0 0 1px rgba(96,165,250,0.2)",
            }}
          >
            {developmentMode}
          </span>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 10,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "var(--ink)" }}>{total}</span>
              <span style={{ color: "var(--ink-muted)" }}>Total</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "var(--accent-emerald)" }}>
                {completed}
              </span>
              <span style={{ color: "var(--ink-muted)" }}>Done</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "var(--accent-blue)" }}>{inProgress}</span>
              <span style={{ color: "var(--ink-muted)" }}>In Progress</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "var(--ink-muted)" }}>{remaining}</span>
              <span style={{ color: "var(--ink-muted)" }}>Remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase sections */}
      {phases.map((phase) => (
        <PhaseSection key={phase.name} phase={phase} />
      ))}
    </div>
  );
}
