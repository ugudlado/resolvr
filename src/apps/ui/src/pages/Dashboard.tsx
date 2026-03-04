import { useState, useEffect, useCallback, useMemo } from "react";
import { featureApi, type FeatureInfo } from "../services/featureApi";
import FeatureCard from "../components/dashboard/FeatureCard";
import { APP_NAME } from "../config/app";

function ChevronIcon({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`${className ?? ""} transition-transform ${open ? "rotate-90" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 3a5 5 0 0 0-4.546 2.914.5.5 0 1 1-.908-.418A6 6 0 0 1 14 8a.5.5 0 0 1-1 0 5 5 0 0 0-5-5zm4.546 7.086a.5.5 0 1 1 .908.418A6 6 0 0 1 2 8a.5.5 0 0 1 1 0 5 5 0 0 0 5.546 4.986z" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
    </div>
  );
}

function isCompleted(feature: FeatureInfo): boolean {
  return feature.status === "complete";
}

export default function Dashboard() {
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await featureApi.getFeatures();
      setFeatures(data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load features");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const { active, completed } = useMemo(() => {
    const active: FeatureInfo[] = [];
    const completed: FeatureInfo[] = [];
    const q = searchQuery.toLowerCase();
    for (const f of features) {
      if (
        !f.id.toLowerCase().includes(q) &&
        !f.branch.toLowerCase().includes(q)
      )
        continue;
      (isCompleted(f) ? completed : active).push(f);
    }
    return { active, completed };
  }, [features, searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="shrink-0 font-serif text-2xl font-semibold text-slate-100">
            {APP_NAME}
          </h1>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter features..."
                className="w-56 rounded-md bg-[var(--bg-base)] py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-600 ring-1 ring-[var(--border-default)] transition-all focus:outline-none focus:ring-[var(--accent-blue)]"
              />
            </div>

            <button
              onClick={fetchFeatures}
              disabled={loading}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshIcon className={loading ? "animate-spin" : undefined} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button
              onClick={fetchFeatures}
              className="ml-4 rounded px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-800/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <Spinner />}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Active features */}
            {active.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {active.map((feature) => (
                  <FeatureCard key={feature.id} feature={feature} />
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">
                No active features
              </p>
            )}

            {/* Completed section */}
            <div className="mt-8">
              <button
                onClick={() => setCompletedOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
              >
                <ChevronIcon open={completedOpen} />
                Completed ({completed.length})
              </button>

              {completedOpen && (
                <div className="mt-4">
                  {completed.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {completed.map((feature) => (
                        <FeatureCard key={feature.id} feature={feature} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No completed features
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
