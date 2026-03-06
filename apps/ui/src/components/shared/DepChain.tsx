type DotStatus = "done" | "current" | "pending";

interface ChainDot {
  id: string;
  status: DotStatus;
}

interface DepChainProps {
  dots: ChainDot[];
}

const DOT_COLOR: Record<DotStatus, string> = {
  done: "var(--accent-emerald)",
  current: "var(--accent-blue)",
  pending: "var(--ink-ghost)",
};

export function DepChain({ dots }: DepChainProps) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {dots.map((dot, i) => (
        <span key={dot.id} style={{ display: "flex", alignItems: "center" }}>
          <span
            title={dot.id}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: DOT_COLOR[dot.status],
              flexShrink: 0,
            }}
          />
          {i < dots.length - 1 && (
            <span
              style={{
                width: 12,
                height: 1,
                backgroundColor: "var(--ink-ghost)",
                flexShrink: 0,
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
