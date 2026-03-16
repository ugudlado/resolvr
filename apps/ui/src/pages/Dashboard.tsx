import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { featureApi, type FeatureInfo } from "../services/featureApi";
import FeatureRow from "../components/dashboard/FeatureRow";
import SkeletonRow from "../components/dashboard/SkeletonRow";
import EmptyState from "../components/dashboard/EmptyState";
import { APP_NAME, APP_VERSION } from "../config/app";
import { FEATURE_STATUS, type FeatureStatus } from "../types/sessions";
import { useRepoContext, useWorkspaces } from "../hooks/useRepoContext";

type SortKey = "activity" | "status" | "name";

const STATUS_ORDER: Record<FeatureStatus, number> = {
  code_review: 0,
  design_review: 1,
  code: 2,
  design: 3,
  new: 4,
  complete: 5,
};

function sortFeatures(
  features: FeatureInfo[],
  sortKey: SortKey,
): FeatureInfo[] {
  return [...features].sort((a, b) => {
    if (sortKey === "activity") {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return (
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
    }
    if (sortKey === "status") {
      return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    }
    return a.id.localeCompare(b.id);
  });
}

const STATUS_FILTER_OPTIONS: { value: FeatureStatus | "all"; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "design", label: "Design" },
    { value: "design_review", label: "Design Review" },
    { value: "code", label: "Code" },
    { value: "code_review", label: "Code Review" },
    { value: "complete", label: "Complete" },
  ];

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  appearance: "none" as const,
};

export default function Dashboard() {
  const { repo, workspace, repoName } = useRepoContext();
  const workspaces = useWorkspaces();
  const [, setSearchParams] = useSearchParams();
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | "all">(
    "all",
  );
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await featureApi.getFeatures(repo, workspace);
      setFeatures(data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load features");
    } finally {
      setLoading(false);
    }
  }, [repo, workspace]);

  function handleWorkspaceChange(value: string) {
    if (!value) {
      setSearchParams({});
    } else {
      setSearchParams({ workspace: value });
    }
  }

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  const { sortedFeatures, searchCount, activeFeatures, completedFeatures } =
    useMemo(() => {
      const q = searchQuery.toLowerCase();
      const filtered = features
        .filter(
          (f) =>
            !q ||
            f.id.toLowerCase().includes(q) ||
            f.branch.toLowerCase().includes(q),
        )
        .filter((f) => statusFilter === "all" || f.status === statusFilter);

      // Two-group sort: active first, completed second; each group sorted by sortKey
      const active = sortFeatures(
        filtered.filter((f) => f.status !== FEATURE_STATUS.Complete),
        sortKey,
      );
      const completed = sortFeatures(
        filtered.filter((f) => f.status === FEATURE_STATUS.Complete),
        sortKey,
      );

      const combined = [...active, ...completed];

      let count: string;
      if ((searchQuery || statusFilter !== "all") && features.length > 0) {
        count = `${combined.length} of ${features.length}`;
      } else if (features.length > 0) {
        count = `${features.length}`;
      } else {
        count = "";
      }

      return {
        sortedFeatures: combined,
        searchCount: count,
        activeFeatures: active,
        completedFeatures: completed,
      };
    }, [features, searchQuery, sortKey, statusFilter]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="mx-auto max-w-6xl px-6 py-6 pb-16">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="flex shrink-0 items-baseline gap-2 font-mono text-2xl font-bold tracking-tight text-slate-100">
            {APP_NAME}
            <span className="text-xs font-normal text-[var(--text-muted)]">
              v{APP_VERSION}
            </span>
            {repoName && !workspaces.length && (
              <span className="text-sm font-normal text-slate-400">
                / {repoName}
              </span>
            )}
          </h1>
          {workspaces.length > 0 && (
            <select
              value={workspace ?? ""}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="rounded-md bg-[var(--bg-base)] py-1.5 pl-2.5 pr-7 text-sm text-slate-400 ring-1 ring-[var(--border-default)] focus:outline-none focus:ring-[var(--accent-blue)]"
              style={SELECT_STYLE}
            >
              <option value="">All workspaces</option>
              {workspaces.map((ws) => (
                <option key={ws.name} value={ws.name}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              void fetchFeatures();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={loading ? "animate-spin" : undefined}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filter / sort controls */}
        <div className="mb-4 flex items-center gap-2 border-b border-slate-800/60 pb-4">
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
              className="w-52 rounded-md bg-[var(--bg-base)] py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-600 ring-1 ring-[var(--border-default)] transition-all focus:outline-none focus:ring-[var(--accent-blue)]"
            />
          </div>

          {/* Sort dropdown */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md bg-[var(--bg-base)] py-1.5 pl-2.5 pr-7 text-sm text-slate-400 ring-1 ring-[var(--border-default)] focus:outline-none focus:ring-[var(--accent-blue)]"
            style={SELECT_STYLE}
          >
            <option value="activity">Last active</option>
            <option value="status">Status</option>
            <option value="name">Name</option>
          </select>

          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as FeatureStatus | "all")
            }
            className="rounded-md bg-[var(--bg-base)] py-1.5 pl-2.5 pr-7 text-sm text-slate-400 ring-1 ring-[var(--border-default)] focus:outline-none focus:ring-[var(--accent-blue)]"
            style={SELECT_STYLE}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {searchCount && (
            <span className="text-xs tabular-nums text-slate-500">
              {searchCount}
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button
              onClick={() => {
                void fetchFeatures();
              }}
              className="ml-4 rounded px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-800/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {features.length === 0 && <EmptyState />}

            {features.length > 0 && sortedFeatures.length === 0 && (
              <p className="py-12 text-center text-sm text-slate-500">
                No features matching
                {searchQuery ? ` "${searchQuery}"` : ""}
                {statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}
              </p>
            )}

            {sortedFeatures.length > 0 && (
              <div className="flex flex-col gap-2">
                {/* Show all features when filtering is active */}
                {statusFilter !== "all" || searchQuery ? (
                  sortedFeatures.map((feature) => (
                    <FeatureRow
                      key={feature.id}
                      feature={feature}
                      searchQuery={searchQuery}
                    />
                  ))
                ) : (
                  <>
                    {/* Active features */}
                    {activeFeatures.map((feature) => (
                      <FeatureRow
                        key={feature.id}
                        feature={feature}
                        searchQuery={searchQuery}
                      />
                    ))}

                    {/* Completed features (collapsible) */}
                    {completedFeatures.length > 0 && (
                      <>
                        <button
                          onClick={() => setShowCompleted(!showCompleted)}
                          className="mt-2 flex w-full items-center gap-2 py-2 text-xs text-slate-400 transition-colors hover:text-slate-300"
                        >
                          <div className="h-px flex-1 bg-[var(--border-default)]" />
                          <span>
                            {showCompleted ? "Hide" : "Show"}{" "}
                            {completedFeatures.length} completed
                          </span>
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${showCompleted ? "rotate-180" : ""}`}
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z" />
                          </svg>
                          <div className="h-px flex-1 bg-[var(--border-default)]" />
                        </button>
                        {showCompleted &&
                          completedFeatures.map((feature) => (
                            <FeatureRow
                              key={feature.id}
                              feature={feature}
                              searchQuery={searchQuery}
                            />
                          ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
