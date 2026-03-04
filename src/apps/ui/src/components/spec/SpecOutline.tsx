import { useMemo } from "react";
import type { AnchorMap, AnchorInfo } from "../../utils/specAnchoring";
import type { ReviewThread } from "../../types/sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecOutlineProps {
  anchorMap: AnchorMap;
  threads: ReviewThread[];
  activeBlockIndex?: number;
  onNavigate: (blockIndex: number) => void;
}

interface OutlineEntry {
  /** The heading's AnchorInfo. */
  anchor: AnchorInfo;
  /** Nesting depth (0 = top-level heading). */
  depth: number;
  /** Number of open/unresolved threads anchored within this section. */
  threadCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract heading entries from the anchor map and compute nesting depth
 * and per-section thread counts.
 */
function buildOutline(
  anchorMap: AnchorMap,
  threads: ReviewThread[],
): OutlineEntry[] {
  // Collect all headings in blockIndex order.
  const headings: AnchorInfo[] = [];
  for (const [, info] of anchorMap) {
    if (info.type === "heading") {
      headings.push(info);
    }
  }
  headings.sort((a, b) => a.blockIndex - b.blockIndex);

  // Compute depth from the section path (number of dot-separated segments - 1).
  // e.g. "Architecture" -> depth 0, "Architecture.Components" -> depth 1
  function depthFromPath(path: string): number {
    if (!path) return 0;
    return path.split(".").length - 1;
  }

  // Count threads per heading path. A thread belongs to a heading if
  // the thread's anchor path starts with the heading's path.
  // Only count open (unresolved) threads.
  const openThreads = threads.filter(
    (t) => t.status === "open" && t.anchor.type !== "diff-line",
  );

  function countThreadsForPath(headingPath: string): number {
    if (!headingPath) return 0;
    return openThreads.filter((t) => {
      const threadPath = t.anchor.path;
      return (
        threadPath === headingPath || threadPath.startsWith(headingPath + ".")
      );
    }).length;
  }

  return headings.map((anchor) => ({
    anchor,
    depth: depthFromPath(anchor.path),
    threadCount: countThreadsForPath(anchor.path),
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpecOutline({
  anchorMap,
  threads,
  activeBlockIndex,
  onNavigate,
}: SpecOutlineProps) {
  const entries = useMemo(
    () => buildOutline(anchorMap, threads),
    [anchorMap, threads],
  );

  if (entries.length === 0) {
    return (
      <nav className="py-4 text-center text-xs text-slate-600">
        No headings found
      </nav>
    );
  }

  return (
    <nav className="flex flex-col overflow-auto py-1">
      <div className="mb-2 px-3 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Outline
        </span>
      </div>

      {entries.map((entry) => {
        const isActive = entry.anchor.blockIndex === activeBlockIndex;
        const indent = 12 + entry.depth * 14;

        return (
          <button
            key={entry.anchor.blockIndex}
            type="button"
            onClick={() => onNavigate(entry.anchor.blockIndex)}
            className={`flex w-full items-center justify-between py-1 pr-3 text-left text-xs transition-colors ${
              isActive
                ? "bg-[var(--accent-blue)]/10 border-l-2 border-[var(--accent-blue)] text-slate-200"
                : "border-l-2 border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
            style={{ paddingLeft: `${indent}px` }}
          >
            <span className="min-w-0 truncate">{entry.anchor.preview}</span>

            {entry.threadCount > 0 && (
              <span className="ml-2 shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                {entry.threadCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
