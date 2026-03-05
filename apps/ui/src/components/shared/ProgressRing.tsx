import { useMemo } from "react";

interface ProgressRingProps {
  percentage: number; // 0-100
  size?: number; // default 80
}

export function ProgressRing({ percentage, size = 80 }: ProgressRingProps) {
  const { circumference, offset } = useMemo(() => {
    const circ = 2 * Math.PI * 32;
    const off = circ * (1 - percentage / 100);
    return { circumference: circ, offset: off };
  }, [percentage]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={40}
          cy={40}
          r={32}
          fill="none"
          stroke="var(--border)"
          strokeWidth={6}
        />
        {/* Progress arc */}
        <circle
          cx={40}
          cy={40}
          r={32}
          fill="none"
          stroke="var(--accent-emerald)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      {/* Centered percentage label */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontSize: 18,
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          color: "var(--accent-emerald)",
        }}
      >
        {Math.round(percentage)}%
      </div>
    </div>
  );
}
