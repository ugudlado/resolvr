/**
 * SpecRenderer — two-column flex layout rendering spec markdown with
 * annotatable blocks and an annotation gutter.
 *
 * Architecture:
 *   SpecRenderer
 *   +-- ContentColumn
 *   |   +-- AnnotatableParagraph (registers offsetTop via ref)
 *   |   +-- (diagrams — planned for future version)
 *   |   +-- (inline ComposeBox — future)
 *   +-- AnnotationGutter (continuous rail, renders markers at measured y-offsets)
 *
 * Uses react-markdown with custom component renderers that wrap each
 * block-level element in AnnotatableParagraph. Each renderer extracts text
 * content, hashes it via simpleHash, and looks up the matching AnchorInfo
 * from a reverse hash map — avoiding any dependency on render order.
 */

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import "highlight.js/styles/github-dark.css";
import type { Components } from "react-markdown";
import type { AnchorInfo, AnchorMap } from "../../utils/specAnchoring";
import { buildAnchorMap, simpleHash } from "../../utils/specAnchoring";
import type { ReviewThread, SpecBlockAnchor } from "../../types/sessions";
import { AnnotatableParagraph } from "./AnnotatableParagraph";
import { AnnotationGutter } from "./AnnotationGutter";
import {
  SelectionPopover,
  type SelectionInfo,
} from "../shared/SelectionPopover";
import {
  BlockRangeSelector,
  type BlockRangeSelection,
} from "./BlockRangeSelector";

// ---------------------------------------------------------------------------
// Context — allows deeply nested components to access the anchor map
// ---------------------------------------------------------------------------

export const AnchorMapContext = createContext<AnchorMap>(new Map());

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SpecRendererProps {
  /** Raw spec.md markdown content. */
  markdown: string;
  /** Review threads to display thread counts per block. */
  threads: ReviewThread[];
  /** Called when the user wants to compose a comment on a block. */
  onCompose: (anchor: SpecBlockAnchor) => void;
  /** Block index currently being composed on (highlights that block). */
  composingBlockIndex?: number;
  /** Called when the user navigates to a specific block (e.g., via gutter click). */
  onNavigateToBlock?: (blockIndex: number) => void;
  /** Called when the user replies to a thread inline */
  onReply?: (threadId: string, text: string) => void;
  /** Called when a thread's status changes inline */
  onThreadStatusChange?: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
  /** Called when the inline compose box submits */
  onComposeSubmit?: (text: string) => void;
  /** Called when the inline compose box is cancelled */
  onComposeCancel?: () => void;
  /** Selected text being composed on (for quote display in compose box). */
  composingSelectedText?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpecRenderer({
  markdown,
  threads,
  onCompose,
  composingBlockIndex,
  onNavigateToBlock,
  onReply,
  onThreadStatusChange,
  onComposeSubmit,
  onComposeCancel,
  composingSelectedText,
}: SpecRendererProps) {
  // -------------------------------------------------------------------------
  // Build anchor map from markdown
  // -------------------------------------------------------------------------
  const anchorMap = useMemo(() => buildAnchorMap(markdown), [markdown]);

  // -------------------------------------------------------------------------
  // Track block offsets reported by AnnotatableParagraph components
  // -------------------------------------------------------------------------
  const [offsets, setOffsets] = useState<Map<number, number>>(() => new Map());

  const handleRegisterOffset = useCallback(
    (blockIndex: number, offsetTop: number) => {
      setOffsets((prev) => {
        // Avoid re-render if the value hasn't changed
        if (prev.get(blockIndex) === offsetTop) return prev;
        const next = new Map(prev);
        next.set(blockIndex, offsetTop);
        return next;
      });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Precompute thread counts and thread arrays per block
  // -------------------------------------------------------------------------
  const { threadCountByBlock, threadsByBlock } = useMemo(() => {
    const counts = new Map<number, number>();
    const byBlock = new Map<number, ReviewThread[]>();
    for (const thread of threads) {
      if (thread.anchor.type === "diff-line") continue;
      const anchor = thread.anchor as SpecBlockAnchor;
      if (anchor.blockIndex === null || anchor.blockIndex === undefined)
        continue;
      counts.set(anchor.blockIndex, (counts.get(anchor.blockIndex) ?? 0) + 1);
      const arr = byBlock.get(anchor.blockIndex) ?? [];
      arr.push(thread);
      byBlock.set(anchor.blockIndex, arr);
    }
    return { threadCountByBlock: counts, threadsByBlock: byBlock };
  }, [threads]);

  // -------------------------------------------------------------------------
  // Reverse hash map — keyed by "{type}:{hash}" for O(1) content lookup
  // -------------------------------------------------------------------------
  const hashLookup = useMemo(() => {
    const map = new Map<string, AnchorInfo>();
    for (const [, info] of anchorMap) {
      // Key by type+hash to avoid collisions between different block types
      const key = `${info.type}:${info.hash}`;
      // First entry wins (duplicate hashes are extremely rare with djb2)
      if (!map.has(key)) {
        map.set(key, info);
      }
    }
    return map;
  }, [anchorMap]);

  // -------------------------------------------------------------------------
  // Gutter click handler
  // -------------------------------------------------------------------------
  const handleGutterBlockClick = useCallback(
    (blockIndex: number) => {
      if (onNavigateToBlock) {
        onNavigateToBlock(blockIndex);
      } else {
        // Default: compose on click
        const info = anchorMap.get(blockIndex);
        if (info) {
          onCompose({
            type: info.type,
            hash: info.hash,
            path: info.path,
            preview: info.preview,
            blockIndex: info.blockIndex,
          });
        }
      }
    },
    [anchorMap, onCompose, onNavigateToBlock],
  );

  // -------------------------------------------------------------------------
  // Custom react-markdown renderers
  // -------------------------------------------------------------------------
  const components = useMemo((): Components => {
    /**
     * Extract plain text from React children (recursively).
     */
    function extractText(node: ReactNode): string {
      if (node === null || node === undefined || typeof node === "boolean")
        return "";
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (typeof node === "object" && "props" in node) {
        return extractText((node as ReactElement).props.children);
      }
      return "";
    }

    /**
     * Look up an AnchorInfo by content text and expected type.
     * Returns null if not found (e.g. nested paragraph inside a list item).
     */
    function findAnchor(
      text: string,
      expectedType: AnchorInfo["type"],
    ): AnchorInfo | null {
      const hash = simpleHash(text.trim());
      return hashLookup.get(`${expectedType}:${hash}`) ?? null;
    }

    /**
     * Wrap a block-level element in AnnotatableParagraph using the given info.
     */
    function wrapBlock(info: AnchorInfo, children: ReactNode): ReactNode {
      const bi = info.blockIndex;
      return (
        <AnnotatableParagraph
          anchorInfo={info}
          threadCount={threadCountByBlock.get(bi) ?? 0}
          threads={threadsByBlock.get(bi)}
          onRegisterOffset={handleRegisterOffset}
          onCompose={onCompose}
          onReply={onReply}
          onThreadStatusChange={onThreadStatusChange}
          isComposing={composingBlockIndex === bi}
          onComposeSubmit={
            composingBlockIndex === bi ? onComposeSubmit : undefined
          }
          onComposeCancel={
            composingBlockIndex === bi ? onComposeCancel : undefined
          }
          quotedText={
            composingBlockIndex === bi ? composingSelectedText : undefined
          }
        >
          {children}
        </AnnotatableParagraph>
      );
    }

    /**
     * Helper: create a heading renderer for a given level.
     */
    function makeHeadingRenderer(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
      return function HeadingRenderer({
        children,
        id,
      }: React.JSX.IntrinsicElements[typeof Tag]) {
        const text = extractText(children);
        const info = findAnchor(text, "heading");
        const el = <Tag id={id}>{children}</Tag>;
        return info ? wrapBlock(info, el) : el;
      };
    }

    return {
      p({ children }) {
        const text = extractText(children);
        const info = findAnchor(text, "paragraph");
        const el = <p>{children}</p>;
        // If not found, this is likely a nested paragraph inside a list item
        // (buildAnchorMap skips list item children) — render plain.
        return info ? wrapBlock(info, el) : el;
      },

      h1({ children, id }: React.JSX.IntrinsicElements["h1"]) {
        const text = extractText(children);
        const info = findAnchor(text, "heading");
        // Strip the feature ID slug prefix — the navbar already shows it.
        // "2026-03-02-some-slug: Actual Title" → "Actual Title"
        const stripped = text.replace(/^\d{4}-\d{2}-\d{2}-[^:]+:\s*/, "");
        const el = <h1 id={id}>{stripped !== text ? stripped : children}</h1>;
        return info ? wrapBlock(info, el) : el;
      },
      h2: makeHeadingRenderer("h2"),
      h3: makeHeadingRenderer("h3"),
      h4: makeHeadingRenderer("h4"),
      h5: makeHeadingRenderer("h5"),
      h6: makeHeadingRenderer("h6"),

      li({ children }) {
        const text = extractText(children);
        const info = findAnchor(text, "list-item");
        const el = <li>{children}</li>;
        return info ? wrapBlock(info, el) : el;
      },

      code({ children, className, node, ...rest }) {
        // Inline code — render as-is.
        // Block code (fenced ``` blocks) always has a <pre> parent in the AST,
        // even when no language is specified (className will be undefined).
        const isBlock =
          (node?.position &&
            node.position.start.line !== node.position.end.line) ||
          String(children).includes("\n");
        const hasLanguage = className?.startsWith("language-");
        if (!isBlock && !hasLanguage) {
          return (
            <code className={className} {...rest}>
              {children}
            </code>
          );
        }

        const codeText = String(children).replace(/\n$/, "");

        // Regular fenced code block — look up as "paragraph" type
        // (buildAnchorMap tags non-diagram code as "paragraph")
        const info = findAnchor(codeText, "paragraph");
        const el = (
          <div className="spec-code-block" role="code">
            <code className={className} {...rest}>
              {children}
            </code>
          </div>
        );
        return info ? wrapBlock(info, el) : el;
      },

      // Prevent react-markdown from wrapping code blocks in its own <pre>
      pre({ children }) {
        return <>{children}</>;
      },
    };
  }, [
    hashLookup,
    threadCountByBlock,
    threadsByBlock,
    handleRegisterOffset,
    onCompose,
    onReply,
    onThreadStatusChange,
    onComposeSubmit,
    onComposeCancel,
    composingBlockIndex,
    composingSelectedText,
  ]);

  // -------------------------------------------------------------------------
  // Text selection commenting
  // -------------------------------------------------------------------------
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSelectionComment = useCallback(
    (info: SelectionInfo) => {
      const startInfo = anchorMap.get(info.blockIndex);
      if (!startInfo) return;

      onCompose({
        type: startInfo.type,
        hash: startInfo.hash,
        path: startInfo.path,
        preview: startInfo.preview,
        blockIndex: info.blockIndex,
        selectedText: info.text,
        blockIndexEnd:
          info.blockIndexEnd !== info.blockIndex
            ? info.blockIndexEnd
            : undefined,
      });
    },
    [anchorMap, onCompose],
  );

  const handleBlockRangeComment = useCallback(
    (sel: BlockRangeSelection) => {
      const startInfo = anchorMap.get(sel.startBlockIndex);
      if (!startInfo) return;

      onCompose({
        type: startInfo.type,
        hash: startInfo.hash,
        path: startInfo.path,
        preview: startInfo.preview,
        blockIndex: sel.startBlockIndex,
        blockIndexEnd:
          sel.endBlockIndex !== sel.startBlockIndex
            ? sel.endBlockIndex
            : undefined,
      });
    },
    [anchorMap, onCompose],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <AnchorMapContext.Provider value={anchorMap}>
      <div className="relative flex">
        {/* Content column — enhanced typography */}
        <div
          ref={contentRef}
          className="spec-content prose prose-invert relative min-w-0 max-w-none flex-1 py-6 pl-10 pr-4"
        >
          <SelectionPopover
            containerRef={contentRef}
            onComment={handleSelectionComment}
          />
          <BlockRangeSelector
            containerRef={contentRef}
            onComment={handleBlockRangeComment}
          />
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
              [rehypeHighlight, { detect: false, ignoreMissing: true }],
            ]}
            components={components}
          >
            {markdown}
          </Markdown>
        </div>

        {/* Annotation gutter */}
        <AnnotationGutter
          offsets={offsets}
          threads={threads}
          anchorMap={anchorMap}
          onBlockClick={handleGutterBlockClick}
        />
      </div>
    </AnchorMapContext.Provider>
  );
}
