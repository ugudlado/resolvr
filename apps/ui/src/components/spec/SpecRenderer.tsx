/**
 * SpecRenderer — TipTap-based spec markdown renderer with per-block annotation
 * affordances (hover compose, thread count badges, text selection commenting).
 *
 * Architecture:
 *   SpecRenderer
 *   +-- TipTap editor (read-only, with custom React Node Views)
 *   |   +-- ParagraphNodeView (wraps each paragraph with AnnotatableNodeView)
 *   |   +-- HeadingNodeView   (wraps each heading)
 *   |   +-- ListItemNodeView  (wraps each list item)
 *   |   +-- CodeBlockNodeView (wraps each code block)
 *   +-- SelectionPopover (floating, on text selection)
 *   +-- BlockRangeSelector (capture-phase, on "+" button drag)
 *
 * The posToBlockIndex map bridges TipTap's character-position world to
 * the sequential blockIndex world of buildAnchorMap(). It is built once
 * after TipTap loads the document by walking doc.descendants().
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Heading } from "@tiptap/extension-heading";
import { ListItem } from "@tiptap/extension-list";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import type { AnchorMap } from "../../utils/specAnchoring";
import { buildAnchorMap } from "../../utils/specAnchoring";
import type { ReviewThread, SpecBlockAnchor } from "../../types/sessions";
import {
  SelectionPopover,
  type SelectionInfo,
} from "../shared/SelectionPopover";
import {
  BlockRangeSelector,
  type BlockRangeSelection,
} from "./BlockRangeSelector";
import {
  SpecRendererContext,
  type SpecRendererContextValue,
} from "./nodeviews/SpecRendererContext";
import { ParagraphNodeView } from "./nodeviews/ParagraphNodeView";
import { HeadingNodeView } from "./nodeviews/HeadingNodeView";
import { ListItemNodeView } from "./nodeviews/ListItemNodeView";
import { CodeBlockNodeView } from "./nodeviews/CodeBlockNodeView";

// ---------------------------------------------------------------------------
// Context — allows deeply nested components to access the anchor map
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const AnchorMapContext = createContext<AnchorMap>(new Map());

// ---------------------------------------------------------------------------
// lowlight instance (created once at module level)
// ---------------------------------------------------------------------------

const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Custom extensions with React Node Views
// These extend the base TipTap extensions to add React-based NodeViews that
// render AnnotatableNodeView affordances around each block element.
// ---------------------------------------------------------------------------

const AnnotatableParagraph = Paragraph.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ParagraphNodeView);
  },
});

const AnnotatableHeading = Heading.extend({
  addNodeView() {
    return ReactNodeViewRenderer(HeadingNodeView);
  },
});

const AnnotatableListItem = ListItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ListItemNodeView);
  },
});

const AnnotatableCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
}).configure({ lowlight });

// ---------------------------------------------------------------------------
// Props — same interface as the old react-markdown SpecRenderer
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
  /** Called when a thread's severity changes inline */
  onSeverityChange?: (threadId: string, severity: string) => void;
  /** Called when the inline compose box submits */
  onComposeSubmit?: (text: string) => void;
  /** Called when the inline compose box is cancelled */
  onComposeCancel?: () => void;
  /** Selected text being composed on (for quote display in compose box). */
  composingSelectedText?: string;
  /** Whether the editor is in edit mode (editable). */
  isEditMode?: boolean;
  /** Called with new markdown content when user saves in edit mode. */
  onSave?: (markdown: string) => void;
  /** Called when user cancels edit mode (after content is reverted). */
  onCancelEdit?: () => void;
}

// ---------------------------------------------------------------------------
// Annotatable node types — the same node types indexed by buildAnchorMap()
// ---------------------------------------------------------------------------

const ANNOTATABLE_TYPES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "codeBlock",
]);

// ---------------------------------------------------------------------------
// Build position → blockIndex map from TipTap document
//
// Walks doc.descendants() to enumerate annotatable nodes in document order
// (same order as buildAnchorMap's remark AST walk) and assigns sequential
// blockIndex values. The char position of each node maps to its index.
// ---------------------------------------------------------------------------

function buildPosToBlockIndex(editor: Editor): Map<number, number> {
  const doc = editor.state.doc;
  const newMap = new Map<number, number>();
  let blockIdx = 0;

  doc.descendants((node, pos) => {
    if (ANNOTATABLE_TYPES.has(node.type.name)) {
      newMap.set(pos, blockIdx++);
      // For listItem, skip descending into its children so we don't
      // double-count nested paragraphs (mirrors buildAnchorMap behavior)
      if (node.type.name === "listItem") {
        return false;
      }
    }
    return true;
  });

  return newMap;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpecRenderer({
  markdown,
  threads,
  onCompose,
  composingBlockIndex,
  onNavigateToBlock: _onNavigateToBlock,
  onReply,
  onThreadStatusChange,
  onSeverityChange,
  onComposeSubmit,
  onComposeCancel,
  composingSelectedText,
  isEditMode = false,
  onSave,
  onCancelEdit,
}: SpecRendererProps) {
  // -------------------------------------------------------------------------
  // Build anchor map from markdown (remark AST pre-pass)
  // -------------------------------------------------------------------------
  const anchorMap = useMemo(() => buildAnchorMap(markdown), [markdown]);

  // hashLookup (keyed by "{type}:{hash}") is built by T008 (edit/save anchor
  // write-back) from anchorMap. Not needed here — anchorMap is the source.

  // -------------------------------------------------------------------------
  // Position → blockIndex mapping
  // Built once after TipTap loads the document by walking doc.descendants().
  // -------------------------------------------------------------------------
  const [posToBlockIndex, setPosToBlockIndex] = useState<Map<number, number>>(
    () => new Map(),
  );

  // -------------------------------------------------------------------------
  // Precompute thread counts and thread arrays per block
  // -------------------------------------------------------------------------
  const { threadCountByBlock, threadsByBlock } = useMemo(() => {
    const counts = new Map<number, number>();
    const byBlock = new Map<number, ReviewThread[]>();
    for (const thread of threads) {
      if (thread.anchor.type === "diff-line") continue;
      const anchor = thread.anchor;
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
  // Content ref (used by selection popover and block range selector)
  // -------------------------------------------------------------------------
  const contentRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // TipTap editor setup
  //
  // StarterKit is configured with paragraph/heading/listItem/codeBlock disabled
  // so we can provide our own extended versions with React Node Views.
  // StarterKit also includes Link by default in v3, but we include our own
  // configured version too.
  // -------------------------------------------------------------------------
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Disable nodes we replace with annotatable versions
          paragraph: false,
          heading: false,
          listItem: false,
          codeBlock: false,
          // Disable StarterKit's built-in Link (we configure our own below)
          link: false,
        }),
        // Annotatable versions of block nodes (with React NodeViews)
        AnnotatableParagraph,
        AnnotatableHeading,
        AnnotatableListItem,
        AnnotatableCodeBlock,
        // Markdown parsing/serialization
        Markdown.configure({
          html: false,
          tightLists: true,
          tightListClass: "tight",
          bulletListMarker: "-",
          linkify: false,
          breaks: false,
          transformPastedText: false,
          transformCopiedText: false,
        }),
        // Link extension
        Link.configure({ openOnClick: !isEditMode }),
        // Placeholder text
        Placeholder.configure({
          placeholder: "Spec content will appear here…",
        }),
      ],
      editable: isEditMode,
      content: "",
      immediatelyRender: false,
      onCreate({ editor: e }) {
        e.commands.setContent(markdown);
        setPosToBlockIndex(buildPosToBlockIndex(e));

        // T007: DEV-only round-trip hash fidelity validation.
        // After TipTap loads and serializes the markdown, buildAnchorMap()
        // must produce identical hashes for all blocks. Mismatches indicate
        // that tiptap-markdown is normalizing content in a way that would
        // break stored anchor hashes after a save.
        if (import.meta.env.DEV) {
          const serialized = (
            e.storage as { markdown?: { getMarkdown?: () => unknown } }
          ).markdown?.getMarkdown?.() as string | undefined;
          if (serialized) {
            const originalMap = buildAnchorMap(markdown);
            const serializedMap = buildAnchorMap(serialized);

            let mismatches = 0;
            for (const [idx, origInfo] of originalMap) {
              const serializedInfo = serializedMap.get(idx);
              if (!serializedInfo) {
                console.warn(
                  `[SpecRenderer] Round-trip: block ${idx} missing in serialized output`,
                );
                mismatches++;
              } else if (serializedInfo.hash !== origInfo.hash) {
                console.warn(
                  `[SpecRenderer] Round-trip hash mismatch at block ${idx}:`,
                  {
                    type: origInfo.type,
                    original: origInfo.preview,
                    serialized: serializedInfo.preview,
                    origHash: origInfo.hash,
                    serializedHash: serializedInfo.hash,
                  },
                );
                mismatches++;
              }
            }
            if (mismatches === 0) {
              // eslint-disable-next-line no-console
              console.info(
                `[SpecRenderer] Round-trip validation: all ${originalMap.size} block hashes match ✓`,
              );
            } else {
              console.warn(
                `[SpecRenderer] Round-trip validation: ${mismatches} hash mismatches found`,
              );
            }
          }
        }
      },
      onUpdate({ editor: e }) {
        setPosToBlockIndex(buildPosToBlockIndex(e));
      },
    },
    [isEditMode],
  );

  // -------------------------------------------------------------------------
  // Update editor editable state when isEditMode changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditMode);
  }, [editor, isEditMode]);

  // -------------------------------------------------------------------------
  // Update editor content when markdown prop changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!editor) return;
    // Compare against current markdown to avoid infinite loops
    const current =
      (
        editor.storage as { markdown?: { getMarkdown?: () => string } }
      ).markdown?.getMarkdown?.() ?? "";
    if (current !== markdown) {
      editor.commands.setContent(markdown, { emitUpdate: false });
      setPosToBlockIndex(buildPosToBlockIndex(editor));
    }
  }, [editor, markdown]);

  // -------------------------------------------------------------------------
  // Text selection commenting (T009)
  // SelectionPopover works via document selectionchange — no special handling
  // needed for TipTap since selectionchange fires regardless of ProseMirror.
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Block range commenting (T009)
  // BlockRangeSelector uses capture-phase mousedown to fire before ProseMirror.
  // It is disabled in edit mode.
  // -------------------------------------------------------------------------
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
  // T008: Edit mode — Save and Cancel handlers
  // -------------------------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!editor || !onSave) return;
    const newMarkdown = (
      editor.storage as { markdown?: { getMarkdown?: () => unknown } }
    ).markdown?.getMarkdown?.() as string | undefined;
    if (newMarkdown !== undefined) {
      onSave(newMarkdown);
    }
  }, [editor, onSave]);

  const handleCancelEdit = useCallback(() => {
    if (!editor) return;
    // Revert editor content to the original markdown prop
    editor.commands.setContent(markdown);
    setPosToBlockIndex(buildPosToBlockIndex(editor));
    onCancelEdit?.();
  }, [editor, markdown, onCancelEdit]);

  // -------------------------------------------------------------------------
  // SpecRendererContext value — passed down to Node Views via React context
  // -------------------------------------------------------------------------
  const contextValue = useMemo<SpecRendererContextValue>(
    () => ({
      threadsByBlock,
      threadCountByBlock,
      anchorMap,
      posToBlockIndex,
      onCompose,
      composingBlockIndex,
      onReply,
      onThreadStatusChange,
      onSeverityChange,
      onComposeSubmit:
        composingBlockIndex !== undefined ? onComposeSubmit : undefined,
      onComposeCancel:
        composingBlockIndex !== undefined ? onComposeCancel : undefined,
      composingSelectedText,
      isEditMode,
    }),
    [
      threadsByBlock,
      threadCountByBlock,
      anchorMap,
      posToBlockIndex,
      onCompose,
      composingBlockIndex,
      onReply,
      onThreadStatusChange,
      onSeverityChange,
      onComposeSubmit,
      onComposeCancel,
      composingSelectedText,
      isEditMode,
    ],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <AnchorMapContext.Provider value={anchorMap}>
      <SpecRendererContext.Provider value={contextValue}>
        <div ref={contentRef} className="relative min-w-0 flex-1 py-6">
          {/* T009: SelectionPopover — listens on document selectionchange,
                scoped to blocks inside containerRef. Works with TipTap's
                ProseMirror selection model since text selection fires
                selectionchange as normal. */}
          <SelectionPopover
            containerRef={contentRef}
            onComment={handleSelectionComment}
          />

          {/* T009: BlockRangeSelector — disabled in edit mode.
                Uses capture-phase mousedown (addEventListener(..., true))
                to intercept before ProseMirror's own handlers fire. */}
          {!isEditMode && (
            <BlockRangeSelector
              containerRef={contentRef}
              onComment={handleBlockRangeComment}
            />
          )}

          {/* TipTap editor content */}
          <div className="text-ink mx-auto max-w-[720px] px-10 py-10 font-sans">
            <EditorContent
              editor={editor}
              className="tiptap-spec-content outline-none"
            />
          </div>

          {/* T008: Floating save/cancel toolbar — visible only in edit mode */}
          {isEditMode && (
            <div className="bg-canvas-raised/95 border-border sticky bottom-0 flex items-center justify-end gap-2 border-t px-4 py-2 backdrop-blur-sm">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-ink-muted hover:text-ink hover:bg-canvas-overlay rounded px-3 py-1.5 text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="bg-accent-blue hover:bg-accent-blue/90 rounded px-4 py-1.5 text-[13px] font-medium text-white transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </SpecRendererContext.Provider>
    </AnchorMapContext.Provider>
  );
}
