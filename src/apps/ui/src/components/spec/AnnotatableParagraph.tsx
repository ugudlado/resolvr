import { useRef, useEffect, useCallback, useState } from "react";
import type { AnchorInfo } from "../../utils/specAnchoring";
import type { ReviewThread, SpecBlockAnchor } from "../../types/sessions";
import { ThreadCard } from "../shared/ThreadCard";
import { ComposeBox } from "../shared/ComposeBox";

export interface AnnotatableParagraphProps {
  anchorInfo: AnchorInfo;
  children: React.ReactNode;
  threadCount: number;
  /** Full thread objects for inline rendering below the block */
  threads?: ReviewThread[];
  onRegisterOffset: (blockIndex: number, offsetTop: number) => void;
  onCompose: (anchor: SpecBlockAnchor) => void;
  onReply?: (threadId: string, text: string) => void;
  onThreadStatusChange?: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
  isComposing?: boolean;
  /** Called when the compose box submits */
  onComposeSubmit?: (text: string) => void;
  onComposeCancel?: () => void;
  /** Quoted text from text selection to show in compose box. */
  quotedText?: string;
}

/**
 * Wraps a markdown block with annotation affordances.
 *
 * Responsibilities:
 * - Reports its offsetTop to the parent (for AnnotationGutter alignment)
 * - Shows a hover effect and "+" button to start composing a comment
 * - Displays a thread-count badge when threads exist
 * - Highlights when the compose box is active for this block
 */
export function AnnotatableParagraph({
  anchorInfo,
  children,
  threadCount,
  threads,
  onRegisterOffset,
  onCompose,
  onReply,
  onThreadStatusChange,
  isComposing = false,
  onComposeSubmit,
  onComposeCancel,
  quotedText,
}: AnnotatableParagraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // -------------------------------------------------------------------------
  // Position reporting — notify parent of offsetTop on mount and resize
  // -------------------------------------------------------------------------
  const reportOffset = useCallback(() => {
    if (containerRef.current) {
      onRegisterOffset(anchorInfo.blockIndex, containerRef.current.offsetTop);
    }
  }, [anchorInfo.blockIndex, onRegisterOffset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Report initial position
    reportOffset();

    // Track layout changes via ResizeObserver
    const observer = new ResizeObserver(() => {
      reportOffset();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [reportOffset]);

  // -------------------------------------------------------------------------
  // Compose handler — convert AnchorInfo to SpecBlockAnchor
  // -------------------------------------------------------------------------
  const handleCompose = useCallback(() => {
    const anchor: SpecBlockAnchor = {
      type: anchorInfo.type,
      hash: anchorInfo.hash,
      path: anchorInfo.path,
      preview: anchorInfo.preview,
      blockIndex: anchorInfo.blockIndex,
    };
    onCompose(anchor);
  }, [anchorInfo, onCompose]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={`group relative -mx-3 rounded-sm px-3 transition-colors duration-150 ${isComposing ? "bg-[var(--accent-blue)]/10 border-l-2 border-[var(--accent-blue)]" : "border-l-2 border-transparent"} ${!isComposing && isHovered ? "bg-[var(--bg-surface)]/60" : ""} `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-block-index={anchorInfo.blockIndex}
    >
      {/* Compose button — visible on hover */}
      <button
        type="button"
        onClick={handleCompose}
        title="Add comment"
        data-compose-button={anchorInfo.blockIndex}
        className={`absolute -left-8 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-[var(--color-success)] text-xs font-bold text-white shadow-sm transition-opacity duration-100 hover:bg-[var(--color-success)] ${isHovered ? "opacity-100" : "opacity-0"} `}
        aria-label={`Add comment on block ${anchorInfo.blockIndex}`}
      >
        +
      </button>

      {/* Thread count badge — shown when threads exist, always visible */}
      {threadCount > 0 && (
        <span
          className={`absolute -right-2 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-blue)] px-1 text-[10px] font-semibold text-white transition-opacity duration-100 ${isHovered ? "opacity-100" : "opacity-80"} `}
          title={`${threadCount} comment${threadCount !== 1 ? "s" : ""}`}
          aria-label="View annotations"
        >
          {threadCount}
        </span>
      )}

      {/* Markdown content */}
      {children}

      {/* Inline compose box — shown when composing on this block */}
      {isComposing && onComposeSubmit && (
        <div className="border-[var(--accent-blue)]/50 mb-1 ml-2 mt-2 border-l-2 pl-3">
          <ComposeBox
            onSubmit={onComposeSubmit}
            onCancel={onComposeCancel}
            placeholder="Write a comment..."
            autoFocus
            quotedText={quotedText}
          />
        </div>
      )}

      {/* Inline threads — rendered below the annotated content */}
      {threads && threads.length > 0 && onReply && onThreadStatusChange && (
        <div className="mb-1 mt-2 space-y-2">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onReply={onReply}
              onStatusChange={onThreadStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
