import { FLAGS } from "../../config/app";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-700/60 ${className ?? ""}`}
    />
  );
}

export default function SkeletonRow() {
  return (
    <div
      className="grid items-center gap-4 border-l-[3px] border-l-slate-700/50 bg-[var(--bg-surface)] px-4 py-3"
      style={{ gridTemplateColumns: "2.5fr 1fr 1.5fr 1.2fr auto" }}
    >
      {/* Col 1: Title + branch */}
      <div className="flex flex-col gap-1.5">
        <SkeletonPulse className="h-3.5 w-3/5" />
        <SkeletonPulse className="h-2.5 w-2/5" />
      </div>

      {/* Col 2: Status pill — matches FeatureRow's FLAGS.DEV_WORKFLOW conditional */}
      {FLAGS.DEV_WORKFLOW ? (
        <div>
          <SkeletonPulse className="h-5 w-20 rounded-full" />
        </div>
      ) : (
        <div />
      )}

      {/* Col 3: Metrics */}
      <div className="flex flex-col gap-1.5">
        <SkeletonPulse className="h-2.5 w-16" />
        <SkeletonPulse className="h-2.5 w-12" />
      </div>

      {/* Col 4: Progress bar — matches FeatureRow's FLAGS.DEV_WORKFLOW conditional */}
      {FLAGS.DEV_WORKFLOW ? (
        <div className="flex flex-col gap-1.5">
          <SkeletonPulse className="h-1 w-full" />
          <SkeletonPulse className="h-2 w-14" />
        </div>
      ) : (
        <div />
      )}

      {/* Col 5: Time */}
      <div>
        <SkeletonPulse className="h-2.5 w-10" />
      </div>
    </div>
  );
}
