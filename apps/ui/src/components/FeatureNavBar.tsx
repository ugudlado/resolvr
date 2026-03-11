import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getStatusConfig } from "../utils/featureStatus";
import { useFeatures } from "../hooks/useFeaturesContext";
import { useFeatureHeader } from "../hooks/useFeatureHeader";
import { formatFeatureLabel } from "../utils/formatFeatureLabel";
import { FLAGS } from "../config/app";

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
 *
 * Two-row layout:
 * - Row 1: ← Dashboard / feature-switcher     [path copy]
 * - Row 2: [Spec] [Tasks] [Code] tabs          [headerActions]
 *
 * Active tab highlighting uses Notion dark tokens from tailwind.config.js.
 * Header actions (verdict buttons, edit toggle) are injected by pages via
 * the FeatureHeaderContext.
 */
export default function FeatureNavBar({ featureId }: FeatureNavBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { headerActions } = useFeatureHeader();

  const basePath = `/features/${featureId}`;

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

  const currentFeature = useMemo(
    () => features.find((f) => f.id === featureId),
    [features, featureId],
  );

  // Detect active tab segment so we preserve it when switching features
  // Fall back to "code" for branch features (no spec), "spec" otherwise
  const defaultFallbackTab =
    currentFeature && !currentFeature.hasSpec ? "code" : "spec";
  const activeTabPath =
    tabs.find((t) => pathname.startsWith(`${basePath}/${t.path}`))?.path ??
    defaultFallbackTab;

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
      void navigate(`/features/${id}/${activeTabPath}`);
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

  return (
    <header className="border-border bg-canvas-raised/95 relative z-20 shrink-0 border-b backdrop-blur-md">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1: back link / feature switcher / worktree path                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-4 pb-0 pt-2.5">
        {/* ← Dashboard link */}
        <Link
          to="/"
          className="text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-medium">Dashboard</span>
        </Link>

        {/* Separator */}
        <span className="text-ink-ghost select-none text-xs">/</span>

        {/* Feature switcher dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="hover:bg-canvas-elevated flex max-w-xs items-center gap-2 rounded-md px-2 py-1 transition-colors"
          >
            <span className="text-ink truncate font-mono text-sm font-medium">
              {formatFeatureLabel(featureId)}
            </span>

            {/* Status badge */}
            {currentFeature &&
              (() => {
                const config = getStatusConfig(currentFeature.status);
                return (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.color} ${config.bgColor}`}
                  >
                    {config.label}
                  </span>
                );
              })()}

            {/* Chevron */}
            <svg
              className={`text-ink-faint h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M2.22 4.22a.75.75 0 0 1 1.06 0L6 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L2.22 5.28a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="border-border bg-canvas-raised absolute left-0 top-full z-50 mt-1 w-96 rounded-lg border shadow-lg shadow-black/40">
              {/* Search input */}
              <div className="border-border border-b p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter features..."
                  className="bg-canvas-elevated text-ink placeholder-ink-faint ring-border focus:ring-accent-blue w-full rounded px-2.5 py-1.5 text-xs outline-none ring-1"
                />
              </div>

              {/* Feature list */}
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="text-ink-faint px-3 py-4 text-center text-xs">
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
                        className={`hover:bg-canvas-elevated flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors ${
                          f.id === featureId
                            ? "bg-accent-blue/10 text-accent-blue"
                            : "text-ink-muted"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-ink truncate font-mono">
                            {formatFeatureLabel(f.id)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${fConfig.color} ${fConfig.bgColor}`}
                          >
                            {fConfig.label}
                          </span>
                        </span>
                        <span className="text-ink-faint truncate font-mono text-[10px]">
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

        {/* Worktree path + copy button — pushed to the right */}
        {currentFeature && (
          <div className="ml-auto flex items-center gap-1.5 overflow-hidden">
            <span className="text-ink-faint truncate font-mono text-[11px]">
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
              className="text-ink-faint hover:bg-canvas-elevated hover:text-ink-muted shrink-0 rounded p-1 transition-colors"
              aria-label="Copy worktree path"
              title="Copy worktree path"
            >
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="text-accent-emerald h-3.5 w-3.5"
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

      {/* ------------------------------------------------------------------ */}
      {/* Row 2: tab pills (left) + header actions slot (right)              */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className="flex items-center gap-1 px-3 pb-0 pt-1"
        aria-label="Feature tabs"
      >
        {FLAGS.DEV_WORKFLOW &&
          tabs.map((tab) => {
            const tabPath = `${basePath}/${tab.path}`;
            const isActive = pathname.startsWith(tabPath);

            // Hide Spec/Tasks tabs when feature has no spec/tasks
            if (
              tab.path === "spec" &&
              currentFeature &&
              !currentFeature.hasSpec
            )
              return null;
            if (
              tab.path === "tasks" &&
              currentFeature &&
              !currentFeature.hasTasks
            )
              return null;

            const isDisabled =
              tab.path === "code" && currentFeature?.status === "complete";

            if (isDisabled) {
              return (
                <span
                  key={tab.path}
                  className="text-ink-ghost cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium"
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
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-blue/12 text-accent-blue"
                    : "text-ink-muted hover:bg-canvas-elevated hover:text-ink"
                }`}
              >
                {tab.label}

                {/* Spec tab: amber open-thread badge */}
                {tab.path === "spec" &&
                  currentFeature &&
                  currentFeature.openThreads > 0 && (
                    <span className="bg-accent-amber/15 text-accent-amber rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      {currentFeature.openThreads}
                    </span>
                  )}

                {/* Tasks tab: progress indicator */}
                {tab.path === "tasks" && currentFeature && (
                  <span className="text-ink-faint text-[10px] font-medium">
                    {currentFeature.taskProgress.done}/
                    {currentFeature.taskProgress.total}
                  </span>
                )}
              </Link>
            );
          })}

        {/* Header actions injected by pages (verdict buttons, edit toggle, etc.) */}
        {headerActions && (
          <div className="ml-auto flex items-center gap-2">{headerActions}</div>
        )}
      </nav>
    </header>
  );
}
