import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getStatusConfig } from "../utils/featureStatus";
import { useFeatures } from "../hooks/useFeaturesContext";

import { formatFeatureLabel } from "../utils/formatFeatureLabel";

interface FeatureNavBarProps {
  featureId: string;
}

const tabs = [
  { label: "Spec", path: "spec" },
  { label: "Tasks", path: "tasks" },
  { label: "Code", path: "code" },
] as const;

/**
 * Persistent top navigation bar for feature views.
 * Shows a back arrow, feature switcher dropdown, and [Spec] [Tasks] [Code] tab buttons.
 * Active tab is highlighted based on the current route.
 */
export default function FeatureNavBar({ featureId }: FeatureNavBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const basePath = `/features/${featureId}`;

  // Detect active tab segment so we preserve it when switching features
  const activeTabPath =
    tabs.find((t) => pathname.startsWith(`${basePath}/${t.path}`))?.path ??
    "spec";

  // -------------------------------------------------------------------------
  // Feature switcher dropdown state
  // -------------------------------------------------------------------------
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { features, refresh: refreshFeatures } = useFeatures();
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Refresh features when dropdown opens (for fresh data)
  useEffect(() => {
    if (dropdownOpen) refreshFeatures();
  }, [dropdownOpen, refreshFeatures]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    } else {
      setSearchQuery("");
    }
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const handleSwitch = useCallback(
    (id: string) => {
      setDropdownOpen(false);
      navigate(`/features/${id}/${activeTabPath}`);
    },
    [navigate, activeTabPath],
  );

  const filtered = useMemo(
    () =>
      features.filter((f) =>
        f.id.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [features, searchQuery],
  );

  const currentFeature = useMemo(
    () => features.find((f) => f.id === featureId),
    [features, featureId],
  );

  return (
    <header className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Back arrow */}
        <Link
          to="/"
          className="text-slate-400 transition-colors hover:text-slate-200"
          aria-label="Back to dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>

        {/* Feature switcher dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded px-2 py-1 font-mono text-sm font-semibold text-slate-200 transition-colors hover:bg-[var(--bg-elevated)]"
          >
            {formatFeatureLabel(featureId)}
            {/* Status badge — shown when features are loaded */}
            {currentFeature &&
              (() => {
                const config = getStatusConfig(currentFeature.status);
                return (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.color} ${config.bgColor}`}
                  >
                    {config.label}
                  </span>
                );
              })()}
            <svg
              className={`h-3 w-3 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M2.22 4.22a.75.75 0 0 1 1.06 0L6 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L2.22 5.28a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-96 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg shadow-black/40">
              {/* Search input */}
              <div className="border-b border-[var(--bg-elevated)] p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter features..."
                  className="w-full rounded bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none ring-1 ring-[var(--border-default)] focus:ring-[var(--accent-blue)]"
                />
              </div>

              {/* Feature list */}
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-600">
                    No features found
                  </div>
                ) : (
                  filtered.map((f) => {
                    const fConfig = getStatusConfig(f.status);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSwitch(f.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-elevated)] ${
                          f.id === featureId
                            ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue-text)]"
                            : "text-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-mono">
                            {formatFeatureLabel(f.id)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${fConfig.color} ${fConfig.bgColor}`}
                          >
                            {fConfig.label}
                          </span>
                        </span>
                        <span className="truncate font-mono text-[10px] text-slate-600">
                          {f.worktreePath}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Worktree path + copy button */}
        {currentFeature && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="truncate font-mono text-xs text-slate-500">
              {currentFeature.worktreePath}
            </span>
            <button
              type="button"
              onClick={() => {
                if (copyTimeoutRef.current)
                  clearTimeout(copyTimeoutRef.current);
                void navigator.clipboard.writeText(currentFeature.worktreePath);
                setCopied(true);
                copyTimeoutRef.current = setTimeout(
                  () => setCopied(false),
                  1500,
                );
              }}
              className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-[var(--bg-elevated)] hover:text-slate-300"
              aria-label="Copy worktree path"
              title="Copy worktree path"
            >
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5 text-green-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11V8.621a3 3 0 0 0-.879-2.121L9 4.379A3 3 0 0 0 6.879 3.5H5.5Z" />
                  <path d="M4 5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 14h5a1.5 1.5 0 0 0 1.5-1.5V8.621a1.5 1.5 0 0 0-.44-1.06L7.94 5.439A1.5 1.5 0 0 0 6.878 5H4Z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 px-4" aria-label="Feature tabs">
        {tabs.map((tab) => {
          const tabPath = `${basePath}/${tab.path}`;
          const isActive = pathname.startsWith(tabPath);
          const currentFeature = features.find((f) => f.id === featureId);
          const isDisabled =
            tab.path === "code" && currentFeature?.status === "complete";

          if (isDisabled) {
            return (
              <span
                key={tab.path}
                className="cursor-not-allowed border-b-2 border-transparent px-3 pb-1.5 pt-0.5 font-mono text-sm font-medium text-slate-600"
                title="No active worktree for completed feature"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tabPath}
              className={`border-b-2 px-3 pb-1.5 pt-0.5 font-mono text-sm font-medium transition-colors ${
                isActive
                  ? "border-blue-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:border-[var(--border-default)] hover:text-slate-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
