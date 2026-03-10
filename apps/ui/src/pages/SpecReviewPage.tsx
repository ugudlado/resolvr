import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { featureApi } from "../services/featureApi";
import { useSpecSession } from "../hooks/useSpecSession";
import { useFeatureHeader } from "../hooks/useFeatureHeader";
import { buildAnchorMap, resolveAnchor } from "../utils/specAnchoring";
import { SpecOutline } from "../components/spec/SpecOutline";
import { SpecRenderer } from "../components/spec/SpecRenderer";
import { ThreadNav } from "../components/spec/ThreadNav";
import {
  AuthorType,
  type SpecBlockAnchor,
  type ReviewThread,
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
    saveSession,
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
    (text: string) => {
      if (!composingAnchor) return;

      const newThread: ReviewThread = {
        id: crypto.randomUUID(),
        anchor: composingAnchor,
        status: "open",
        severity: "improvement", // auto-triage will reclassify
        messages: [
          {
            id: crypto.randomUUID(),
            text,
            author: "reviewer",
            authorType: AuthorType.Human,
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
            authorType: AuthorType.Human,
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

  const handleSeverityChange = useCallback(
    (threadId: string, severity: string) => {
      void patchThread(threadId, { severity });
    },
    [patchThread],
  );

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const specScrollRef = useRef<HTMLElement>(null);

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
      // Update active section when navigating via outline
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
      el ??= container.querySelector(`[data-block-index="${blockIndex}"]`);

      if (el) {
        const offsetTop = (el as HTMLElement).offsetTop;
        container.scrollTo({ top: offsetTop, behavior: "smooth" });
      }
    },
    [anchorMap],
  );

  // -------------------------------------------------------------------------
  // Edit mode (T008)
  // -------------------------------------------------------------------------

  const [isEditMode, setIsEditMode] = useState(false);

  const threads = useMemo(() => session?.threads ?? [], [session?.threads]);

  // -------------------------------------------------------------------------
  // Save spec with anchor write-back (T008)
  // -------------------------------------------------------------------------

  const handleSaveSpec = useCallback(
    async (newMarkdown: string) => {
      if (!featureId) return;

      // 1. Rebuild AnchorMap from new markdown
      const newAnchorMap = buildAnchorMap(newMarkdown);

      // 2. For each spec thread, run resolveAnchor and update if drifted.
      //    patchThread only supports status/messages, so we update anchors
      //    directly on the session and persist the full session via saveSession.
      const specThreads = (session?.threads ?? []).filter(
        (t) => t.anchor.type !== "diff-line",
      );

      let updatedSession = session;
      for (const thread of specThreads) {
        const anchor = thread.anchor as SpecBlockAnchor;
        const resolution = resolveAnchor(newAnchorMap, anchor);

        if (resolution.status === "drifted") {
          const newInfo = newAnchorMap.get(resolution.blockIndex);
          if (newInfo && updatedSession) {
            const patchedAnchor = {
              ...anchor,
              blockIndex: resolution.blockIndex,
              hash: resolution.newHash,
            };
            updatedSession = {
              ...updatedSession,
              threads: updatedSession.threads.map((t) =>
                t.id === thread.id ? { ...t, anchor: patchedAnchor } : t,
              ),
            };
          }
        }
        // "orphaned" threads keep their current anchor (flagged in UI)
        // "valid" threads need no update
      }

      // 3. Persist updated session if any anchors changed
      if (updatedSession && updatedSession !== session) {
        await saveSession(updatedSession);
      }

      // 4. Save spec content to disk
      try {
        await featureApi.saveSpec(featureId, newMarkdown);
      } catch (err) {
        setSpecError(
          err instanceof Error ? err.message : "Failed to save spec",
        );
        return;
      }

      // 5. Update local spec content and exit edit mode
      setSpecContent(newMarkdown);
      setIsEditMode(false);
    },
    [featureId, session, saveSession],
  );

  // -------------------------------------------------------------------------
  // Active thread state (for ThreadNav highlight)
  // -------------------------------------------------------------------------

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Thread click → scroll to inline thread element with flash highlight
  // -------------------------------------------------------------------------

  const handleThreadClick = useCallback((threadId: string) => {
    setActiveThreadId(threadId);

    // Scroll to the inline thread element with data-thread-id
    const threadEl = document.querySelector(`[data-thread-id="${threadId}"]`);
    if (threadEl) {
      threadEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Brief highlight animation
      threadEl.classList.add(
        "ring-2",
        "ring-accent-blue",
        "ring-offset-2",
        "ring-offset-canvas",
      );
      setTimeout(() => {
        threadEl.classList.remove(
          "ring-2",
          "ring-accent-blue",
          "ring-offset-2",
          "ring-offset-canvas",
        );
      }, 1500);
    }
  }, []);
  const openThreadCount = useMemo(
    () =>
      threads.filter((t) => t.status !== "resolved" && t.status !== "approved")
        .length,
    [threads],
  );

  // -------------------------------------------------------------------------
  // Header actions — inject Edit toggle + verdict buttons via FeatureHeaderContext (T008)
  // -------------------------------------------------------------------------

  const { setHeaderActions } = useFeatureHeader();

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        {/* Edit toggle */}
        <button
          type="button"
          onClick={() => setIsEditMode((m) => !m)}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
            isEditMode
              ? "bg-accent-amber/15 text-accent-amber"
              : "text-ink-muted hover:text-ink hover:bg-canvas-elevated"
          }`}
        >
          {isEditMode ? "Editing" : "Edit"}
        </button>

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Thread count */}
        {openThreadCount > 0 && (
          <span className="text-ink-muted text-[12px]">
            {openThreadCount} open
          </span>
        )}

        {/* Approve button */}
        <button
          type="button"
          onClick={() => void setVerdict("approved")}
          className="bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
          Approve
        </button>

        {/* Request Changes button — disabled when 0 open threads */}
        <button
          type="button"
          onClick={() => void setVerdict("changes_requested")}
          disabled={openThreadCount === 0}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
            openThreadCount === 0
              ? "bg-canvas-elevated/50 text-ink-ghost cursor-not-allowed"
              : "bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25"
          }`}
        >
          Request Changes
        </button>
      </div>,
    );
  }, [isEditMode, openThreadCount, setVerdict, setHeaderActions]);

  // Clean up header actions on unmount
  useEffect(() => {
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  // -------------------------------------------------------------------------
  // Command palette, shortcut help & thread navigation (T074 + T075)
  // -------------------------------------------------------------------------

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // j/k shortcut: cycle through threads by ID using activeThreadId
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
        case "j": {
          if (threads.length === 0) break;
          const currentIdx = activeThreadId
            ? threads.findIndex((t) => t.id === activeThreadId)
            : -1;
          const nextIdx = Math.min(currentIdx + 1, threads.length - 1);
          const nextThread = threads[nextIdx];
          if (nextThread) handleThreadClick(nextThread.id);
          break;
        }
        case "k": {
          if (threads.length === 0) break;
          const currentIdx = activeThreadId
            ? threads.findIndex((t) => t.id === activeThreadId)
            : 0;
          const prevIdx = Math.max(currentIdx - 1, 0);
          const prevThread = threads[prevIdx];
          if (prevThread) handleThreadClick(prevThread.id);
          break;
        }
        case "Escape":
          setHelpOpen(false);
          setPaletteOpen(false);
          setActiveThreadId(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [threads, activeThreadId, handleThreadClick]);

  const [paletteItems, setPaletteItems] = useState<
    {
      id: string;
      label: string;
      group: "Files" | "Threads" | "Actions";
      onAction: () => void;
      shortcut?: string;
    }[]
  >([]);

  useEffect(() => {
    if (!paletteOpen) return;

    const items: typeof paletteItems = [];

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
        onAction: () => handleThreadClick(thread.id),
      });
    }

    items.push({
      id: "action-help",
      label: "Keyboard shortcuts",
      group: "Actions",
      shortcut: "?",
      onAction: () => setHelpOpen(true),
    });

    setPaletteItems(items);
  }, [
    paletteOpen,
    anchorMap,
    threads,
    handleOutlineNavigate,
    handleThreadClick,
  ]);

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

  const error = specError ?? sessionError;

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
    <div className="flex h-full overflow-hidden bg-[var(--bg-base)]">
      {/* Left sidebar — SpecOutline */}
      <SpecOutline
        anchorMap={anchorMap}
        specContent={specContent ?? ""}
        threads={threads}
        activeSection={activeSectionPath}
        onSectionClick={handleOutlineNavigate}
      />

      {/* Center — SpecRenderer with TipTap (read-only or edit mode) */}
      <main ref={specScrollRef} className="min-w-0 flex-1 overflow-y-auto">
        {specContent && (
          <SpecRenderer
            markdown={specContent}
            threads={threads}
            onCompose={handleCompose}
            composingBlockIndex={composingAnchor?.blockIndex}
            onNavigateToBlock={handleOutlineNavigate}
            onReply={handleReply}
            onThreadStatusChange={handleThreadStatusChange}
            onSeverityChange={handleSeverityChange}
            onComposeSubmit={handleComposeSubmit}
            onComposeCancel={handleComposeCancel}
            composingSelectedText={composingAnchor?.selectedText}
            isEditMode={isEditMode}
            onSave={(md) => void handleSaveSpec(md)}
            onCancelEdit={() => setIsEditMode(false)}
          />
        )}
      </main>

      {/* Right sidebar — ThreadNav (slim 240px thread navigator) */}
      <ThreadNav
        threads={threads}
        anchorMap={anchorMap}
        activeThreadId={activeThreadId ?? undefined}
        onThreadClick={handleThreadClick}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
