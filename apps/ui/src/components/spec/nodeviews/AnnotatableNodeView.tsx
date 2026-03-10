/**
 * AnnotatableNodeView — shared annotatable wrapper used by all block Node Views.
 *
 * Provides:
 * - Hover state with a "+" compose button (left side, absolutely positioned)
 * - Thread count badge (right side) when threads exist for this block
 * - Composing highlight when this block is the active compose target
 * - data-block-index attribute for BlockRangeSelector / SelectionPopover targeting
 * - InlineThread callouts rendered below block content (T011)
 * - ComposeBox rendered below content when this block is the active compose target (T011)
 */

import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useSpecRendererContext } from "./SpecRendererContext";
import { InlineThread } from "../InlineThread";
import { ComposeBox } from "../../shared/ComposeBox";
import type { SpecBlockAnchor } from "../../../types/sessions";

interface AnnotatableNodeViewProps {
  blockIndex: number | undefined;
  children: ReactNode;
  /** The anchor data to pass when composing — derived from anchorMap. */
  getAnchor: () => SpecBlockAnchor | null;
}

export function AnnotatableNodeView({
  blockIndex,
  children,
  getAnchor,
}: AnnotatableNodeViewProps) {
  const {
    threadsByBlock,
    threadCountByBlock,
    composingBlockIndex,
    onCompose,
    onReply,
    onThreadStatusChange,
    onSeverityChange,
    onComposeSubmit,
    onComposeCancel,
    composingSelectedText,
    isEditMode,
  } = useSpecRendererContext();

  const [isHovered, setIsHovered] = useState(false);

  const isComposing =
    blockIndex !== undefined && composingBlockIndex === blockIndex;
  const threadCount =
    blockIndex !== undefined ? (threadCountByBlock.get(blockIndex) ?? 0) : 0;

  // Get threads for this block, sorted oldest-first (natural reading order)
  const blockThreads =
    blockIndex !== undefined
      ? (threadsByBlock.get(blockIndex) ?? [])
          .slice()
          .sort(
            (a, b) =>
              new Date(a.messages[0]?.createdAt ?? 0).getTime() -
              new Date(b.messages[0]?.createdAt ?? 0).getTime(),
          )
      : [];

  const handleCompose = useCallback(() => {
    const anchor = getAnchor();
    if (anchor) {
      onCompose(anchor);
    }
  }, [getAnchor, onCompose]);

  // Don't show annotation affordances in edit mode or if blockIndex is unknown
  const showAffordances = !isEditMode && blockIndex !== undefined;

  return (
    <div
      className={[
        "group relative -mx-2 rounded px-2 transition-colors",
        isComposing
          ? "bg-accent-blue/8 border-accent-blue border-l-2"
          : "border-l-2 border-transparent",
        !isComposing && isHovered && showAffordances
          ? "bg-canvas-elevated/40"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-block-index={blockIndex}
    >
      {/* Compose "+" button — left side, appears on hover */}
      {showAffordances && (
        <button
          type="button"
          onClick={handleCompose}
          title="Add comment"
          data-compose-button={blockIndex}
          className={[
            "absolute -left-6 top-1 flex h-5 w-5 items-center justify-center",
            "bg-accent-emerald rounded text-xs font-bold text-white shadow-sm",
            "transition-opacity duration-100",
            "hover:opacity-90",
            isHovered ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-label={`Add comment on block ${blockIndex}`}
        >
          +
        </button>
      )}

      {/* Thread count badge — right side */}
      {showAffordances && threadCount > 0 && (
        <span
          className={[
            "absolute -right-1 top-1 flex items-center justify-center",
            "bg-accent-amber rounded-full text-[10px] font-semibold text-white",
            "h-4 min-w-[16px] px-1 transition-opacity duration-100",
            isHovered ? "opacity-100" : "opacity-80",
          ].join(" ")}
          title={`${threadCount} comment${threadCount !== 1 ? "s" : ""}`}
          aria-label="View annotations"
        >
          {threadCount}
        </span>
      )}

      {/* Block content */}
      {children}

      {/* Compose box — rendered below content when this block is the active compose target */}
      {isComposing && !isEditMode && onComposeSubmit && (
        <div className="border-accent-blue/50 mb-1 ml-2 mt-2 border-l-2 pl-3">
          <ComposeBox
            onSubmit={onComposeSubmit}
            onCancel={onComposeCancel}
            placeholder="Write a comment..."
            autoFocus
            quotedText={composingSelectedText}
          />
        </div>
      )}

      {/* InlineThread callouts — sorted oldest-first below the block */}
      {blockThreads.length > 0 && (
        <div>
          {blockThreads.map((thread) => (
            <InlineThread
              key={thread.id}
              thread={thread}
              onReply={onReply}
              onStatusChange={onThreadStatusChange}
              onSeverityChange={onSeverityChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
