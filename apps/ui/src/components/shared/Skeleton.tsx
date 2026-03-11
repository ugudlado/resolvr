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
