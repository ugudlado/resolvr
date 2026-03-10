import { useMemo, useState } from "react";
import type { AnchorMap, AnchorInfo } from "../../utils/specAnchoring";
import type { ReviewThread } from "../../types/sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecOutlineProps {
  anchorMap: AnchorMap;
  specContent: string;
  threads: ReviewThread[];
  activeSection?: string;
  onSectionClick: (blockIndex: number) => void;
}

interface SectionEntry {
  anchor: AnchorInfo;
  /** Nesting depth derived from heading markdown (# count - 1). */
  depth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a map from heading text -> heading depth (1-based, i.e. H1=1, H2=2).
 * Uses regex on raw markdown to count leading '#' characters.
 */
function buildHeadingDepthMap(specContent: string): Map<string, number> {
  const map = new Map<string, number>();
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(specContent)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    // Only set if not already present (first occurrence wins)
    if (!map.has(text)) {
      map.set(text, level);
    }
  }
  return map;
}

/**
 * Collect heading entries from the anchor map in blockIndex order,
 * augmented with depth from the raw markdown heading depth map.
 */
function buildSections(
  anchorMap: AnchorMap,
  headingDepthMap: Map<string, number>,
): SectionEntry[] {
  const headings: AnchorInfo[] = [];
  for (const [, info] of anchorMap) {
    if (info.type === "heading") {
      headings.push(info);
    }
  }
  headings.sort((a, b) => a.blockIndex - b.blockIndex);

  return headings.map((anchor) => {
    const level = headingDepthMap.get(anchor.preview) ?? 2;
    // depth: H2 = 0, H3 = 1, H4+ = 2
    const depth = Math.max(0, level - 2);
    return { anchor, depth };
  });
}

/**
 * Count open threads per section path hierarchy.
 * A thread is "open" if status !== "resolved" && status !== "approved".
 */
function buildThreadCountMap(
  threads: ReviewThread[],
  anchorMap: AnchorMap,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const thread of threads) {
    if (thread.status === "resolved" || thread.status === "approved") continue;
    if (thread.anchor.type === "diff-line") continue;

    const anchor = thread.anchor;
    const info = anchorMap.get(anchor.blockIndex ?? -1);
    if (!info) continue;

    // Count for each heading in the path hierarchy
    const parts = info.path.split(".");
    let pathAccum = "";
    for (const part of parts) {
      pathAccum = pathAccum ? `${pathAccum}.${part}` : part;
      counts.set(pathAccum, (counts.get(pathAccum) ?? 0) + 1);
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Search icon SVG
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--ink-ghost)]"
    >
      <circle
        cx="6.5"
        cy="6.5"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 10.5L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpecOutline({
  anchorMap,
  specContent,
  threads,
  activeSection,
  onSectionClick,
}: SpecOutlineProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const headingDepthMap = useMemo(
    () => buildHeadingDepthMap(specContent),
    [specContent],
  );

  const sections = useMemo(
    () => buildSections(anchorMap, headingDepthMap),
    [anchorMap, headingDepthMap],
  );

  const threadCountBySection = useMemo(
    () => buildThreadCountMap(threads, anchorMap),
    [threads, anchorMap],
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((section) => {
      // Match heading text itself
      if (section.anchor.preview.toLowerCase().includes(q)) return true;
      // Match any block anchored under this section's path
      for (const [, info] of anchorMap) {
        if (
          info.path === section.anchor.path ||
          info.path.startsWith(section.anchor.path + ".")
        ) {
          if (info.preview.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [searchQuery, sections, anchorMap]);

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--canvas-raised)]">
      {/* Search input */}
      <div className="border-b border-[var(--border)] p-2">
        <div className="flex items-center gap-1.5 rounded bg-[var(--canvas-elevated)] px-2.5 py-1.5 ring-1 ring-[var(--border)] transition-colors focus-within:ring-[var(--accent-blue)]">
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections..."
            className="w-full min-w-0 bg-transparent text-[13px] text-[var(--ink)] placeholder-[var(--ink-ghost)] outline-none"
          />
        </div>
      </div>

      {/* "SECTIONS" label */}
      <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-[var(--ink-ghost)]">
        Sections
      </div>

      {/* Section items */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredSections.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-[var(--ink-ghost)]">
            No results
          </div>
        ) : (
          filteredSections.map((section) => {
            const isActive = section.anchor.path === activeSection;
            const threadCount =
              threadCountBySection.get(section.anchor.path) ?? 0;

            // Indentation by heading depth
            const indentByDepth: Record<number, string> = {
              0: "pl-3",
              1: "pl-6",
            };
            const indentClass = indentByDepth[section.depth] ?? "pl-9";

            // Font size by depth
            const fontSizeClass =
              section.depth === 0 ? "text-[13px]" : "text-[12px]";

            return (
              <button
                key={section.anchor.blockIndex}
                type="button"
                onClick={() => onSectionClick(section.anchor.blockIndex)}
                className={[
                  "group flex w-full cursor-pointer items-center gap-1.5 py-1 pr-3 transition-colors",
                  indentClass,
                  fontSizeClass,
                  isActive
                    ? "-ml-px border-l-2 border-[var(--accent-blue)] bg-[var(--canvas-elevated)] text-[var(--ink)]"
                    : "hover:bg-[var(--canvas-elevated)]/50 border-l-2 border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {section.anchor.preview}
                </span>

                {threadCount > 0 && (
                  <span className="bg-[var(--accent-amber)]/15 min-w-[16px] shrink-0 rounded-full px-1 py-0.5 text-center text-[9px] font-semibold text-[var(--accent-amber)]">
                    {threadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
}
