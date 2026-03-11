import { useMemo } from "react";

export interface ThreadProgressRingProps {
  resolved: number;
  open: number;
  size?: number; // default: 28
  thickness?: number; // default: 3
  showCenter?: boolean; // default: false
  className?: string;
}

// Gap between segments in degrees
const SEGMENT_GAP_DEG = 2;

const SEGMENT_TRANSITION =
  "stroke-dasharray 0.45s cubic-bezier(0.4, 0, 0.2, 1), stroke-dashoffset 0.45s cubic-bezier(0.4, 0, 0.2, 1)";

export function ThreadProgressRing({
  resolved,
  open,
  size = 28,
  thickness = 3,
  showCenter = false,
  className = "",
}: ThreadProgressRingProps) {
  const resolvedClamped = Math.max(0, resolved);
  const openClamped = Math.max(0, open);
  const total = resolvedClamped + openClamped;
  const isEmpty = total === 0;
  const isComplete = !isEmpty && openClamped === 0;

  const ring = useMemo(() => {
    const center = size / 2;
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const gapPx = (SEGMENT_GAP_DEG / 360) * circumference;
    const hasBothSegments = resolvedClamped > 0 && openClamped > 0;

    if (isEmpty) {
      return {
        center,
        radius,
        circumference,
        resolvedDash: 0,
        resolvedOffset: 0,
        openDash: 0,
        openOffset: 0,
      };
    }

    const resolvedLen =
      (resolvedClamped / total) * circumference - (hasBothSegments ? gapPx : 0);
    const openLen =
      (openClamped / total) * circumference - (hasBothSegments ? gapPx : 0);

    return {
      center,
      radius,
      circumference,
      resolvedDash: Math.max(0, resolvedLen),
      resolvedOffset: 0,
      openDash: Math.max(0, openLen),
      // Open segment starts after resolved + one gap
      openOffset: hasBothSegments ? -(resolvedLen + gapPx) : 0,
    };
  }, [resolvedClamped, openClamped, total, isEmpty, size, thickness]);

  const percentage = isEmpty ? 0 : Math.round((resolvedClamped / total) * 100);
  const centerColor = isComplete
    ? "var(--accent-emerald)"
    : "var(--accent-amber)";
  const labelText = isEmpty
    ? "no threads"
    : isComplete
      ? "complete"
      : "resolved";
  const centerText = isEmpty ? "—" : `${percentage}%`;
  const pctFontSize = Math.max(6, Math.round(size * 0.28));
  const labelFontSize = Math.max(4, Math.round(size * 0.18));

  const tooltipRows = [
    {
      color: "var(--accent-emerald)",
      label: "Resolved",
      count: resolvedClamped,
    },
    { color: "var(--accent-amber)", label: "Open", count: openClamped },
  ];

  return (
    <div
      className={`group/ring relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      tabIndex={0}
      role="img"
      aria-label={
        isEmpty
          ? "No threads"
          : `${resolvedClamped} of ${total} threads resolved`
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={ring.center}
          cy={ring.center}
          r={ring.radius}
          fill="none"
          stroke="var(--ink-ghost)"
          strokeWidth={thickness}
          opacity={0.35}
        />

        {!isEmpty && (
          <>
            {resolvedClamped > 0 && (
              <circle
                cx={ring.center}
                cy={ring.center}
                r={ring.radius}
                fill="none"
                stroke="var(--accent-emerald)"
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${ring.resolvedDash} ${ring.circumference}`}
                strokeDashoffset={ring.resolvedOffset}
                style={{ transition: SEGMENT_TRANSITION }}
              />
            )}

            {openClamped > 0 && (
              <circle
                cx={ring.center}
                cy={ring.center}
                r={ring.radius}
                fill="none"
                stroke="var(--accent-amber)"
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${ring.openDash} ${ring.circumference}`}
                strokeDashoffset={ring.openOffset}
                style={{ transition: SEGMENT_TRANSITION }}
              />
            )}
          </>
        )}

        {/* Glow pulse ring at 100% complete */}
        {isComplete && (
          <circle
            cx={ring.center}
            cy={ring.center}
            r={ring.radius}
            fill="none"
            stroke="var(--accent-emerald)"
            strokeWidth={thickness * 2}
            opacity={0}
            style={{ animation: "thread-ring-glow 2s ease-in-out infinite" }}
          />
        )}
      </svg>

      {showCenter && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 1 }}
        >
          <span
            style={{
              fontSize: pctFontSize,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: isEmpty ? "var(--ink-ghost)" : centerColor,
              lineHeight: 1,
            }}
          >
            {centerText}
          </span>
          <span
            style={{
              fontSize: labelFontSize,
              color: "var(--ink-faint)",
              lineHeight: 1,
              textTransform: "lowercase",
            }}
          >
            {labelText}
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      <div
        className="pointer-events-none absolute z-50 opacity-0 transition-opacity group-focus-within/ring:opacity-100 group-hover/ring:opacity-100"
        style={{
          top: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: 130,
          background: "var(--canvas-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          borderRadius: 6,
          padding: "6px 8px",
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div
          style={{
            color: "var(--ink-faint)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          Thread Progress
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {tooltipRows.map(({ color, label, count }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "var(--ink-faint)" }}>{label}</span>
              </span>
              <span
                style={{ color: "var(--ink-base, #e6e6e6)", fontWeight: 600 }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
        {total > 0 && (
          <>
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "5px 0",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ color: "var(--ink-faint)" }}>Total</span>
              <span
                style={{ color: "var(--ink-base, #e6e6e6)", fontWeight: 600 }}
              >
                {total}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
