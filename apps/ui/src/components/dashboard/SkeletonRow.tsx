import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonRow() {
  return (
    <div
      className="grid items-center gap-4 border-l-[3px] border-l-slate-700/50 bg-[var(--bg-surface)] px-4 py-3"
      style={{ gridTemplateColumns: "2.5fr 1fr 1.5fr 1.2fr auto" }}
    >
      {/* Col 1: Title + branch */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>

      {/* Col 2: Status pill */}
      <div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Col 3: Metrics */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-12" />
      </div>

      {/* Col 4: Progress bar */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-2 w-14" />
      </div>

      {/* Col 5: Time */}
      <div>
        <Skeleton className="h-2.5 w-10" />
      </div>
    </div>
  );
}
