import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { featureApi } from "../services/featureApi";
import { useSpecSession } from "../hooks/useSpecSession";
import { buildAnchorMap } from "../utils/specAnchoring";
import { SpecOutline } from "../components/spec/SpecOutline";
import { SpecRenderer } from "../components/spec/SpecRenderer";
import { RightPanel } from "../components/spec/RightPanel";
import { ReviewVerdict } from "../components/shared/ReviewVerdict";
import type {
  SpecBlockAnchor,
  ReviewThread,
  ThreadSeverity,
} from "../types/sessions";
import { SpecSkeleton } from "../components/shared/Skeleton";
import { CommandPalette } from "../components/shared/CommandPalette";
import { ShortcutHelp } from "../components/shared/ShortcutHelp";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpecReviewPage() {
  const { featureId } = useParams<{ featureId: string }>();

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const [specContent, setSpecContent] = useState<string | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);

  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    addThread,
    patchThread,
    setVerdict,
  } = useSpecSession(featureId);

  // Load spec content
  useEffect(() => {
    if (!featureId) {
      setSpecContent(null);
      setSpecLoading(false);
      setSpecError(null);
      return;
    }

    let cancelled = false;
    setSpecLoading(true);
    setSpecError(null);

    void (async () => {
      try {
        const { content } = await featureApi.getSpec(featureId);
        if (!cancelled) {
          setSpecContent(content);
          setSpecLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setSpecError(
            err instanceof Error ? err.message : "Failed to load spec",
          );
          setSpecLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  // -------------------------------------------------------------------------
  // Anchor map (memoized from spec content)
  // -------------------------------------------------------------------------

  const anchorMap = useMemo(
    () => (specContent ? buildAnchorMap(specContent) : new Map()),
    [specContent],
  );

  // -------------------------------------------------------------------------
  // Compose state
  // -------------------------------------------------------------------------

  const [composingAnchor, setComposingAnchor] =
    useState<SpecBlockAnchor | null>(null);

  const handleCompose = useCallback((anchor: SpecBlockAnchor) => {
    setComposingAnchor(anchor);
  }, []);

  const handleComposeSubmit = useCallback(
    (text: string, severity?: ThreadSeverity) => {
      if (!composingAnchor) return;

      const newThread: ReviewThread = {
        id: crypto.randomUUID(),
        anchor: composingAnchor,
        status: "open",
        severity,
        messages: [
          {
            id: crypto.randomUUID(),
            text,
            author: "reviewer",
            authorType: "human",
            createdAt: new Date().toISOString(),
          },
        ],
        lastUpdatedAt: new Date().toISOString(),
      };

      void addThread(newThread);
      setComposingAnchor(null);
    },
    [composingAnchor, addThread],
  );

  const handleComposeCancel = useCallback(() => {
    setComposingAnchor(null);
  }, []);

  // -------------------------------------------------------------------------
  // Thread handlers
  // -------------------------------------------------------------------------

  const handleReply = useCallback(
    (threadId: string, text: string) => {
      void patchThread(threadId, {
        messages: [
          {
            id: crypto.randomUUID(),
            text,
            author: "reviewer",
            authorType: "human",
            createdAt: new Date().toISOString(),
          },
        ],
      });
    },
    [patchThread],
  );

  const handleThreadStatusChange = useCallback(
    (threadId: string, status: "open" | "resolved" | "approved") => {
      void patchThread(threadId, { status });
    },
    [patchThread],
  );

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const [activeBlockIndex, setActiveBlockIndex] = useState<
    number | undefined
  >();

  const specScrollRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Active section tracking via scroll position
  // -------------------------------------------------------------------------

  const [activeSectionPath, setActiveSectionPath] = useState<string>("");

  useEffect(() => {
    const container = specScrollRef.current;
    if (!container || !specContent) return;

    const updateActiveSection = () => {
      // Skip h1 (document title) — section tracking uses h2+ headings
      const headings = container.querySelectorAll("h2, h3, h4, h5, h6");
      let bestPath = "";

      // Find the last heading whose top is at or above the scroll threshold
      // (top 20% of the container viewport)
      const threshold = container.scrollTop + container.clientHeight * 0.2;

      for (const h of headings) {
        const blockEl = h.closest("[data-block-index]");
        if (!blockEl) continue;
        const idx = parseInt(
          blockEl.getAttribute("data-block-index") ?? "",
          10,
        );
        if (isNaN(idx)) continue;
        const info = anchorMap.get(idx);
        if (info?.type !== "heading") continue;

        const top = (blockEl as HTMLElement).offsetTop;
        if (top <= threshold) {
          bestPath = info.path;
        } else {
          break; // Headings are in document order, no need to continue
        }
      }

      if (bestPath) {
        setActiveSectionPath(bestPath);
      }
    };

    // Run once on mount and on every scroll
    updateActiveSection();
    container.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });
    return () => container.removeEventListener("scroll", updateActiveSection);
  }, [specContent, anchorMap]);

  const handleOutlineNavigate = useCallback(
    (blockIndex: number) => {
      setActiveBlockIndex(blockIndex);
      // Also update active section when navigating via outline
      const navInfo = anchorMap.get(blockIndex);
      if (navInfo?.type === "heading") {
        setActiveSectionPath(navInfo.path);
      }
      const container = specScrollRef.current;
      if (!container) return;

      const info = anchorMap.get(blockIndex);
      let el: Element | null = null;

      // For headings, use rehype-slug id or text content (immune to blockIndex desync)
      if (info?.type === "heading") {
        // Try rehype-slug id first (github-slugger algorithm)
        const slug = info.preview
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        const heading = container.querySelector(`[id="${slug}"]`);
        el =
          heading?.closest("[data-block-index]") ??
          heading?.parentElement ??
          null;

        // Fallback: match heading by text content
        if (!el) {
          const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
          for (const h of headings) {
            if (h.textContent?.trim() === info.preview) {
              el = h.closest("[data-block-index]") ?? h.parentElement ?? h;
              break;
            }
          }
        }
      }

      // For non-headings (or if heading lookup failed), use data-block-index
      if (!el) {
        el = container.querySelector(`[data-block-index="${blockIndex}"]`);
      }

      if (el) {
        const offsetTop = (el as HTMLElement).offsetTop;
        container.scrollTo({ top: offsetTop, behavior: "smooth" });
      }
    },
    [anchorMap],
  );

  // -------------------------------------------------------------------------
  // Verdict
  // -------------------------------------------------------------------------

  const handleVerdictChange = useCallback(
    (verdict: "approved" | "changes_requested") => {
      void setVerdict(verdict);
    },
    [setVerdict],
  );

  // -------------------------------------------------------------------------
  // Edit mode
  // -------------------------------------------------------------------------

  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEditToggle = useCallback(() => {
    if (!isEditing && specContent) {
      setEditDraft(specContent);
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, specContent]);

  const handleEditSave = useCallback(async () => {
    if (!featureId || !editDraft) return;
    setSaving(true);
    try {
      await featureApi.saveSpec(featureId, editDraft);
      setSpecContent(editDraft);
      setIsEditing(false);
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Failed to save spec");
    } finally {
      setSaving(false);
    }
  }, [featureId, editDraft]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditDraft("");
  }, []);

  const threads = session?.threads ?? [];

  // -------------------------------------------------------------------------
  // Thread click → scroll to anchored block with flash highlight
  // -------------------------------------------------------------------------

  const handleThreadClick = useCallback(
    (threadId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread || thread.anchor.type === "diff-line") return;
      const anchor = thread.anchor as SpecBlockAnchor;
      const container = specScrollRef.current;
      if (!container) return;

      const el = container.querySelector(
        `[data-block-index="${anchor.blockIndex}"]`,
      );
      if (!el) return;

      // Use scrollTo on the known scroll container (same pattern as handleOutlineNavigate)
      // instead of scrollIntoView which can target the wrong ancestor in nested layouts.
      const offsetTop = (el as HTMLElement).offsetTop;
      const centerOffset = Math.max(0, offsetTop - container.clientHeight / 2);
      container.scrollTo({ top: centerOffset, behavior: "smooth" });

      // Flash highlight
      el.classList.add("block-flash-highlight");
      const onEnd = () => {
        el.classList.remove("block-flash-highlight");
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
    },
    [threads],
  );
  const openThreadCount = threads.filter((t) => t.status === "open").length;

  // -------------------------------------------------------------------------
  // Command palette, shortcut help & thread navigation (T074 + T075)
  // -------------------------------------------------------------------------

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedThreadIndex, setFocusedThreadIndex] = useState(-1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      switch (e.key) {
        case "?":
          setHelpOpen((prev) => !prev);
          break;
        case "j":
          setFocusedThreadIndex((prev) => prev + 1);
          break;
        case "k":
          setFocusedThreadIndex((prev) => Math.max(-1, prev - 1));
          break;
        case "Escape":
          setHelpOpen(false);
          setPaletteOpen(false);
          setFocusedThreadIndex(-1);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (focusedThreadIndex < 0) return;
    const threadElements = document.querySelectorAll("[data-thread-id]");
    const target = threadElements[focusedThreadIndex] as
      | HTMLElement
      | undefined;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      target.classList.add(
        "ring-2",
        "ring-[var(--accent-blue)]",
        "ring-offset-1",
      );
      const prev = threadElements[focusedThreadIndex - 1] as
        | HTMLElement
        | undefined;
      const next = threadElements[focusedThreadIndex + 1] as
        | HTMLElement
        | undefined;
      prev?.classList.remove(
        "ring-2",
        "ring-[var(--accent-blue)]",
        "ring-offset-1",
      );
      next?.classList.remove(
        "ring-2",
        "ring-[var(--accent-blue)]",
        "ring-offset-1",
      );
      return () => {
        target.classList.remove(
          "ring-2",
          "ring-[var(--accent-blue)]",
          "ring-offset-1",
        );
      };
    }
  }, [focusedThreadIndex]);

  const paletteItems = useMemo(() => {
    const items: {
      id: string;
      label: string;
      group: "Files" | "Threads" | "Actions";
      onAction: () => void;
      shortcut?: string;
    }[] = [];

    // Sections from anchorMap
    for (const [blockIndex, info] of anchorMap.entries()) {
      if (info.type === "heading") {
        items.push({
          id: `section-${blockIndex}`,
          label: info.preview,
          group: "Files",
          onAction: () => handleOutlineNavigate(blockIndex),
        });
      }
    }

    // Threads
    for (const thread of threads) {
      const anchor = thread.anchor as {
        path?: string;
        blockIndex?: number;
        preview?: string;
      };
      const preview = thread.messages[0]?.text?.slice(0, 60) ?? "Thread";
      items.push({
        id: `thread-${thread.id}`,
        label: `${anchor.path ?? ""} — ${preview}`,
        group: "Threads",
        onAction: () => {
          handleThreadClick(thread.id);
        },
      });
    }

    // Actions
    items.push({
      id: "action-help",
      label: "Keyboard shortcuts",
      group: "Actions",
      shortcut: "?",
      onAction: () => setHelpOpen(true),
    });

    return items;
  }, [anchorMap, threads, handleOutlineNavigate, handleThreadClick]);

  // -------------------------------------------------------------------------
  // Guard: missing featureId
  // -------------------------------------------------------------------------

  if (!featureId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)] text-slate-400">
        No feature selected
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  const isLoading = specLoading || sessionLoading;

  if (isLoading) {
    return (
      <div className="flex h-full bg-[var(--bg-base)]">
        <SpecSkeleton />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  const error = specError || sessionError;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="max-w-md rounded-lg border border-red-800 bg-red-900/20 px-6 py-4 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full bg-[var(--bg-base)]">
      {/* Left sidebar — SpecOutline */}
      <div className="w-[200px] shrink-0 overflow-y-auto border-r border-slate-700/50">
        <SpecOutline
          anchorMap={anchorMap}
          threads={threads}
          activeBlockIndex={activeBlockIndex}
          onNavigate={handleOutlineNavigate}
        />
      </div>

      {/* Center — SpecRenderer / Editor + Diagrams */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Edit toggle toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-muted)] bg-[var(--bg-surface)] px-4 py-1.5">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            specs/active/spec.md
          </span>
          <div className="flex items-center gap-1.5">
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="rounded-md bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleEditSave()}
                  disabled={saving}
                  className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleEditToggle}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isEditing
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {isEditing ? "Preview" : "Edit"}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div ref={specScrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {isEditing ? (
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none bg-[var(--bg-base)] p-6 font-mono text-sm leading-relaxed text-slate-300 outline-none"
            />
          ) : (
            <>
              {specContent && (
                <SpecRenderer
                  markdown={specContent}
                  threads={threads}
                  onCompose={handleCompose}
                  composingBlockIndex={composingAnchor?.blockIndex}
                  onNavigateToBlock={handleOutlineNavigate}
                  onReply={handleReply}
                  onThreadStatusChange={handleThreadStatusChange}
                  onComposeSubmit={handleComposeSubmit}
                  onComposeCancel={handleComposeCancel}
                  composingSelectedText={composingAnchor?.selectedText}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right sidebar — Verdict + Thread index */}
      <aside className="flex w-[320px] shrink-0 flex-col border-l border-[var(--border-muted)] bg-[var(--bg-base)]">
        {/* Verdict bar */}
        <div className="flex items-center justify-end gap-2 border-b border-[var(--border-muted)] px-3 py-2">
          {openThreadCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              {openThreadCount} open
            </span>
          )}
          <ReviewVerdict
            verdict={session?.verdict ?? null}
            onVerdictChange={handleVerdictChange}
            openThreadCount={openThreadCount}
            disabled={!session}
          />
        </div>

        {/* Threads */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RightPanel
            threads={threads}
            onReply={handleReply}
            onThreadStatusChange={handleThreadStatusChange}
            onThreadClick={handleThreadClick}
            activeSectionPath={activeSectionPath}
          />
        </div>
      </aside>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
