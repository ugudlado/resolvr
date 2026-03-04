function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded ${className ?? ""}`}
      style={{
        backgroundImage: `linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

export function DiffSkeleton({ rows = 20 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-px p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <SkeletonBlock className="h-3 w-8" />
          <SkeletonBlock className="h-3 w-8" />
          <SkeletonBlock
            className={`h-3 ${["w-3/4", "w-1/2", "w-2/3", "w-5/6"][i % 4]}`}
          />
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <SkeletonBlock className="h-3 w-3 rounded-full" />
          <SkeletonBlock
            className={`h-3 ${["w-32", "w-24", "w-40", "w-28"][i % 4]}`}
          />
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border-default)] p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <SkeletonBlock className="h-4 w-16 rounded-full" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="mb-1 h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SpecSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-4/5" />
      <div className="mt-4" />
      <SkeletonBlock className="h-6 w-1/2" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-2/3" />
    </div>
  );
}
