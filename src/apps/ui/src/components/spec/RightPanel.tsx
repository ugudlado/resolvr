import { useState, useMemo } from "react";
import type { ReviewThread, SpecBlockAnchor } from "../../types/sessions";
import { ThreadCard } from "../shared/ThreadCard";
import { ThreadStatusTabs } from "../shared/ThreadStatusTabs";
import { useThreadPartition } from "../../hooks/useThreadPartition";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RightPanelProps {
  threads: ReviewThread[];
  onReply: (threadId: string, message: string) => void;
  onThreadStatusChange: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
  onThreadClick?: (threadId: string) => void;
  /** Current section path from scroll position (e.g. "Architecture.Components"). */
  activeSectionPath?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThreadFilter = "open" | "resolved";
type ScopeFilter = "all" | "section";

/**
 * Extract the h2-level section name from a dotted path.
 * Paths are formatted as "H1Title.H2Section.H3Sub..." — the first segment
 * is the document title (h1), so we use the second segment as the meaningful
 * top-level section. Falls back to the full path if only one segment.
 */
function topLevelSection(path: string): string {
  const parts = path.split(".");
  // If there's a second segment, that's the h2-level section
  return parts.length >= 2 ? parts[1] : parts[0];
}

/** Group threads by their top-level section. */
function groupBySection(threads: ReviewThread[]): Map<string, ReviewThread[]> {
  const map = new Map<string, ReviewThread[]>();
  for (const t of threads) {
    if (t.anchor.type === "diff-line") continue;
    const anchor = t.anchor as SpecBlockAnchor;
    const section = topLevelSection(anchor.path) || "Untitled";
    const arr = map.get(section) ?? [];
    arr.push(t);
    map.set(section, arr);
  }
  return map;
}

// ---------------------------------------------------------------------------
// RightPanel — threads panel with Open/Resolved tabs + section filtering
// ---------------------------------------------------------------------------

export function RightPanel({
  threads,
  onReply,
  onThreadStatusChange,
  onThreadClick,
  activeSectionPath,
}: RightPanelProps) {
  const [activeFilter, setActiveFilter] = useState<ThreadFilter>("open");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const { openThreads, resolvedThreads } = useThreadPartition(threads);

  const statusFiltered =
    activeFilter === "open" ? openThreads : resolvedThreads;

  // Apply section filter
  const visibleThreads = useMemo(() => {
    if (scopeFilter === "all" || !activeSectionPath) return statusFiltered;
    return statusFiltered.filter((t) => {
      if (t.anchor.type === "diff-line") return false;
      const anchor = t.anchor as SpecBlockAnchor;
      return anchor.path.startsWith(activeSectionPath);
    });
  }, [statusFiltered, scopeFilter, activeSectionPath]);

  // Group by section for "all" view
  const grouped = useMemo(
    () => groupBySection(visibleThreads),
    [visibleThreads],
  );

  const currentSectionLabel = activeSectionPath
    ? topLevelSection(activeSectionPath)
    : null;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Tab header — Open / Resolved */}
      <ThreadStatusTabs
        activeFilter={activeFilter}
        openCount={openThreads.length}
        resolvedCount={resolvedThreads.length}
        onFilterChange={setActiveFilter}
        sticky
      />

      {/* Scope filter — All / Current Section */}
      {activeSectionPath && (
        <div className="flex items-center gap-1 border-b border-[var(--border-muted)] px-2 py-1.5">
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              scopeFilter === "all"
                ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("section")}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              scopeFilter === "section"
                ? "bg-blue-500/15 text-blue-400"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Section
            {currentSectionLabel && scopeFilter === "section" && (
              <span className="max-w-[120px] truncate text-[10px] opacity-70">
                {currentSectionLabel}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Thread list */}
      {visibleThreads.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-xs text-slate-600">
          {activeFilter === "open"
            ? threads.length === 0
              ? "No threads yet"
              : scopeFilter === "section"
                ? "No open threads in this section"
                : "All threads resolved"
            : scopeFilter === "section"
              ? "No resolved threads in this section"
              : "No resolved threads"}
        </div>
      ) : scopeFilter === "all" && grouped.size > 1 ? (
        // Grouped view — section headers like CodeThreadsPanel's file headers
        <div className="flex-1 overflow-y-auto">
          {Array.from(grouped.entries()).map(([section, sectionThreads]) => (
            <div key={section}>
              <div className="sticky top-0 z-[5] border-b border-[var(--border-muted)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {section}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {sectionThreads.length}
                </span>
              </div>
              <div className="space-y-2 p-2">
                {sectionThreads.map((thread, index) => (
                  <div
                    key={thread.id}
                    onClick={() => onThreadClick?.(thread.id)}
                    className={`stagger-fade-in ${
                      onThreadClick
                        ? "cursor-pointer rounded transition-colors hover:bg-[var(--bg-surface)]"
                        : ""
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <ThreadCard
                      thread={thread}
                      onReply={onReply}
                      onStatusChange={onThreadStatusChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat list — single section or section-filtered view
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {visibleThreads.map((thread, index) => (
            <div
              key={thread.id}
              onClick={() => onThreadClick?.(thread.id)}
              className={`stagger-fade-in ${
                onThreadClick
                  ? "cursor-pointer rounded transition-colors hover:bg-[var(--bg-surface)]"
                  : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ThreadCard
                thread={thread}
                onReply={onReply}
                onStatusChange={onThreadStatusChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
