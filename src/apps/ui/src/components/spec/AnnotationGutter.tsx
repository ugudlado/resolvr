import { useMemo } from "react";
import type { AnchorMap } from "../../utils/specAnchoring";
import type { ReviewThread, SpecBlockAnchor } from "../../types/sessions";

export interface AnnotationGutterProps {
  /** blockIndex -> offsetTop (px) reported by AnnotatableParagraph refs. */
  offsets: Map<number, number>;
  /** All threads in the current spec review session. */
  threads: ReviewThread[];
  /** Anchor map built from the spec markdown. */
  anchorMap: AnchorMap;
  /** Called when a gutter marker is clicked. */
  onBlockClick: (blockIndex: number) => void;
}

/**
 * Continuous gutter rail rendered as a sibling column alongside the spec
 * content column. Displays pilcrow markers at the measured y-offset of
 * each annotatable block. Markers with existing threads show a thread
 * count badge and are visually emphasized.
 *
 * Layout assumption: parent uses a two-column flex layout where this
 * component occupies the fixed-width right column.
 */
export function AnnotationGutter({
  offsets,
  threads,
  anchorMap,
  onBlockClick,
}: AnnotationGutterProps) {
  // ---------------------------------------------------------------------------
  // Precompute thread counts per blockIndex
  // ---------------------------------------------------------------------------
  const threadCountByBlock = useMemo(() => {
    const counts = new Map<number, number>();
    for (const thread of threads) {
      const anchor = thread.anchor as SpecBlockAnchor;
      if (anchor.blockIndex === null || anchor.blockIndex === undefined)
        continue;
      counts.set(anchor.blockIndex, (counts.get(anchor.blockIndex) ?? 0) + 1);
    }
    return counts;
  }, [threads]);

  // ---------------------------------------------------------------------------
  // Build sorted list of markers
  // ---------------------------------------------------------------------------
  const markers = useMemo(() => {
    const result: Array<{
      blockIndex: number;
      offsetTop: number;
      threadCount: number;
    }> = [];

    for (const [blockIndex, offsetTop] of offsets) {
      // Only render markers for blocks that exist in the anchor map
      if (!anchorMap.has(blockIndex)) continue;

      result.push({
        blockIndex,
        offsetTop,
        threadCount: threadCountByBlock.get(blockIndex) ?? 0,
      });
    }

    // Sort by offsetTop so DOM order matches visual order
    result.sort((a, b) => a.offsetTop - b.offsetTop);
    return result;
  }, [offsets, anchorMap, threadCountByBlock]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="relative w-10 shrink-0 select-none"
      aria-label="Annotation gutter"
      role="complementary"
    >
      {markers.map(({ blockIndex, offsetTop, threadCount }) => {
        const hasThreads = threadCount > 0;

        return (
          <button
            key={blockIndex}
            type="button"
            className={`absolute left-0 flex h-6 w-10 cursor-pointer items-center justify-center border-none bg-transparent transition-colors duration-100 ${
              hasThreads
                ? "text-[var(--accent-blue-text)] hover:text-[var(--accent-blue-text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            } `}
            style={{ top: `${offsetTop}px` }}
            onClick={() => onBlockClick(blockIndex)}
            title={
              hasThreads
                ? `${threadCount} thread${threadCount !== 1 ? "s" : ""} on block ${blockIndex}`
                : `Add comment on block ${blockIndex}`
            }
            aria-label={
              hasThreads
                ? `${threadCount} thread${threadCount !== 1 ? "s" : ""} on block ${blockIndex}`
                : `Add comment on block ${blockIndex}`
            }
            data-block-index={blockIndex}
          >
            {/* Pilcrow marker */}
            <span
              className={`text-sm font-medium leading-none ${hasThreads ? "opacity-100" : "opacity-60 group-hover:opacity-100"} `}
            >
              ¶
            </span>

            {/* Thread count badge */}
            {hasThreads && (
              <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-blue)] px-1 text-[10px] font-semibold leading-none text-white">
                {threadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
