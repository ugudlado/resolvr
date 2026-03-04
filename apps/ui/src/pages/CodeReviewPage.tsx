import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useCodeSession } from "../hooks/useCodeSession";
import { featureApi } from "../services/featureApi";
import {
  parseUnifiedDiff,
  type DiffFile,
  type DiffHunk,
} from "../utils/diffParser";
import { DiffViewWrapper } from "../components/diff/DiffViewWrapper";
import { ComposeWidget, ThreadDisplay } from "../components/diff/ThreadWidget";
import {
  DiffSelectionPopover,
  type DiffSelectionInfo,
} from "../components/diff/DiffSelectionPopover";
import { ReviewVerdict } from "../components/shared/ReviewVerdict";
import { ThreadCard } from "../components/shared/ThreadCard";
import { ThreadStatusTabs } from "../components/shared/ThreadStatusTabs";
import { CommandPalette } from "../components/shared/CommandPalette";
import { ShortcutHelp } from "../components/shared/ShortcutHelp";
import { useThreadPartition } from "../hooks/useThreadPartition";
import type {
  DiffLineAnchor,
  ReviewThread,
  ThreadSeverity,
} from "../types/sessions";
import { DiffSkeleton } from "../components/shared/Skeleton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** File status icon and color for the sidebar. */
function fileStatusIndicator(status: DiffFile["status"]): {
  label: string;
  color: string;
} {
  switch (status) {
    case "A":
      return { label: "A", color: "text-[var(--color-success)]" };
    case "D":
      return { label: "D", color: "text-[var(--color-danger)]" };
    case "M":
      return { label: "M", color: "text-[var(--color-warning)]" };
    default:
      return { label: "U", color: "text-slate-500" };
  }
}

/**
 * Reconstruct raw hunk strings from parsed DiffHunk objects.
 * The DiffViewWrapper needs raw hunk text starting with `@@`.
 */
function hunkToRawString(hunk: DiffHunk): string {
  const lines = [hunk.header];
  for (const line of hunk.lines) {
    switch (line.kind) {
      case "add":
        lines.push("+" + line.content);
        break;
      case "del":
        lines.push("-" + line.content);
        break;
      case "context":
        lines.push(" " + line.content);
        break;
      case "meta":
        lines.push(line.content);
        break;
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// FileSidebar (inline component)
// ---------------------------------------------------------------------------

interface FileSidebarProps {
  files: DiffFile[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  threadCountByFile: Map<string, number>;
}

function FileSidebar({
  files,
  selectedFile,
  onSelectFile,
  threadCountByFile,
}: FileSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)]">
      <div className="border-b border-slate-700/50 px-3 py-2">
        <span className="text-xs font-semibold text-slate-400">
          Files changed
        </span>
        <span className="ml-1.5 text-xs text-slate-600">{files.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => {
          const isSelected = file.path === selectedFile;
          const indicator = fileStatusIndicator(file.status);
          const threadCount = threadCountByFile.get(file.path) ?? 0;

          return (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)] text-slate-200"
                  : "hover:bg-[var(--accent-blue)]/5 border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <span
                className={`shrink-0 font-mono text-[10px] font-bold ${indicator.color}`}
              >
                {indicator.label}
              </span>
              <span className="min-w-0 truncate">{file.path}</span>
              {threadCount > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                  {threadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadPanel (inline component)
// ---------------------------------------------------------------------------

interface ThreadPanelProps {
  threads: ReviewThread[];
  selectedFile: string | null;
  session: {
    verdict: "approved" | "changes_requested" | null;
  } | null;
  onVerdictChange: (verdict: "approved" | "changes_requested") => void;
  onReply: (threadId: string, text: string) => void;
  onStatusChange: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
}

function ThreadPanel({
  threads,
  selectedFile,
  session,
  onVerdictChange,
  onReply,
  onStatusChange,
}: ThreadPanelProps) {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const [filterMode, setFilterMode] = useState<"file" | "all">("file");

  const { openThreads, resolvedThreads } = useThreadPartition(threads);

  const displayedThreads = useMemo(() => {
    const base = statusFilter === "open" ? openThreads : resolvedThreads;
    if (filterMode === "all" || !selectedFile) return base;
    return base.filter(
      (t) => t.anchor.type === "diff-line" && t.anchor.path === selectedFile,
    );
  }, [openThreads, resolvedThreads, statusFilter, selectedFile, filterMode]);

  return (
    <div className="flex h-full flex-col">
      {/* Open / Resolved tabs */}
      <ThreadStatusTabs
        activeFilter={statusFilter}
        openCount={openThreads.length}
        resolvedCount={resolvedThreads.length}
        onFilterChange={setStatusFilter}
      />

      {/* File scope toggle */}
      <div className="flex items-center gap-1 border-b border-slate-700/50 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setFilterMode("file")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            filterMode === "file"
              ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue-text)]"
              : "text-slate-500 hover:text-slate-400"
          }`}
        >
          Current file
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            filterMode === "all"
              ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue-text)]"
              : "text-slate-500 hover:text-slate-400"
          }`}
        >
          All (
          {statusFilter === "open"
            ? openThreads.length
            : resolvedThreads.length}
          )
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {displayedThreads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-600">
            {statusFilter === "open"
              ? threads.length === 0
                ? "No threads yet"
                : filterMode === "file"
                  ? "No open threads for this file"
                  : "All threads resolved"
              : filterMode === "file"
                ? "No resolved threads for this file"
                : "No resolved threads"}
          </p>
        ) : (
          displayedThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onReply={onReply}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>

      {/* Verdict bar — pinned to bottom */}
      <div className="flex items-center justify-between border-t border-slate-700/50 px-3 py-2">
        <span className="text-xs font-medium text-slate-400">Verdict</span>
        <ReviewVerdict
          verdict={session?.verdict ?? null}
          onVerdictChange={onVerdictChange}
          openThreadCount={openThreads.length}
          disabled={!session}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeReviewPage — main component
// ---------------------------------------------------------------------------

export default function CodeReviewPage() {
  const { featureId } = useParams<{ featureId: string }>();

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const {
    session,
    loading,
    error,
    addThread,
    patchThread,
    setVerdict,
    saveSession,
  } = useCodeSession(featureId);

  // -------------------------------------------------------------------------
  // Branch switching state
  // -------------------------------------------------------------------------

  const [branches, setBranches] = useState<string[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const branchSearchRef = useRef<HTMLInputElement>(null);

  // Fetch branches when session loads (we need worktreePath)
  useEffect(() => {
    if (!session?.worktreePath) return;
    let cancelled = false;
    void featureApi.getBranches(session.worktreePath).then((ctx) => {
      if (!cancelled) setBranches(ctx.branches);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.worktreePath]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (branchDropdownOpen) {
      const id = setTimeout(() => branchSearchRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
    setBranchSearch("");
  }, [branchDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!branchDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(e.target as Node)
      ) {
        setBranchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [branchDropdownOpen]);

  const handleSwitchTargetBranch = useCallback(
    async (newTarget: string) => {
      if (!session?.worktreePath || !featureId) return;
      setBranchDropdownOpen(false);
      setSwitching(true);
      try {
        const bundle = await featureApi.regenerateDiff(
          session.worktreePath,
          newTarget,
          session.sourceBranch,
        );
        // Update session with new diff and branch info
        const updated = {
          ...session,
          targetBranch: bundle.targetBranch,
          sourceBranch: bundle.sourceBranch,
          committedDiff: bundle.committedDiff,
          uncommittedDiff: bundle.uncommittedDiff,
          allDiff: bundle.allDiff,
          metadata: {
            ...session.metadata,
            updatedAt: new Date().toISOString(),
          },
        };
        await saveSession(updated);
      } finally {
        setSwitching(false);
      }
    },
    [session, featureId, saveSession],
  );

  const filteredBranches = useMemo(() => {
    if (!branchSearch) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  // -------------------------------------------------------------------------
  // Parse diff into files
  // -------------------------------------------------------------------------

  const diffFiles = useMemo(() => {
    if (!session) return [];
    const rawDiff =
      session.allDiff ||
      [session.committedDiff, session.uncommittedDiff]
        .filter(Boolean)
        .join("\n");
    if (!rawDiff) return [];
    return parseUnifiedDiff(rawDiff);
  }, [session]);

  // -------------------------------------------------------------------------
  // Selection state
  // -------------------------------------------------------------------------

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Auto-select first file when diff files change
  const effectiveSelectedFile = useMemo(() => {
    if (selectedFile && diffFiles.some((f) => f.path === selectedFile)) {
      return selectedFile;
    }
    return diffFiles.length > 0 ? diffFiles[0].path : null;
  }, [selectedFile, diffFiles]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
    setComposingAt(null);
  }, []);

  // -------------------------------------------------------------------------
  // Selected file data
  // -------------------------------------------------------------------------

  const selectedDiffFile = useMemo(
    () => diffFiles.find((f) => f.path === effectiveSelectedFile) ?? null,
    [diffFiles, effectiveSelectedFile],
  );

  const rawHunks = useMemo(() => {
    if (!selectedDiffFile) return [];
    return selectedDiffFile.hunks.map(hunkToRawString);
  }, [selectedDiffFile]);

  // -------------------------------------------------------------------------
  // Thread maps
  // -------------------------------------------------------------------------

  const threads = session?.threads ?? [];

  /** Count of threads per file path (for sidebar badges). */
  const threadCountByFile = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of threads) {
      if (t.anchor.type === "diff-line") {
        const path = t.anchor.path;
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
    }
    return counts;
  }, [threads]);

  /** Threads for the current file, keyed by "old:N" or "new:N" for DiffViewWrapper. */
  const threadsByLine = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const t of threads) {
      if (
        t.anchor.type === "diff-line" &&
        t.anchor.path === effectiveSelectedFile
      ) {
        const key = `${t.anchor.side}:${t.anchor.line}`;
        const existing = map.get(key) ?? [];
        existing.push(t);
        map.set(key, existing);
      }
    }
    return map;
  }, [threads, effectiveSelectedFile]);

  // -------------------------------------------------------------------------
  // Compose state
  // -------------------------------------------------------------------------

  const [composingAt, setComposingAt] = useState<{
    lineNumber: number;
    side: "old" | "new";
    selectedText?: string;
  } | null>(null);

  const diffContainerRef = useRef<HTMLDivElement>(null);

  const handleAddComment = useCallback(
    (lineNumber: number, side: "old" | "new") => {
      setComposingAt({ lineNumber, side });
    },
    [],
  );

  const handleSelectionComment = useCallback((info: DiffSelectionInfo) => {
    setComposingAt({
      lineNumber: info.lineNumber,
      side: info.side,
      selectedText: info.text,
    });
  }, []);

  const handleComposeSubmit = useCallback(
    (anchor: DiffLineAnchor, text: string, severity?: ThreadSeverity) => {
      const newThread: ReviewThread = {
        id: crypto.randomUUID(),
        anchor,
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
      setComposingAt(null);
    },
    [addThread],
  );

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

  const handleVerdictChange = useCallback(
    (verdict: "approved" | "changes_requested") => {
      void setVerdict(verdict);
    },
    [setVerdict],
  );

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

    // Files
    for (const file of diffFiles) {
      items.push({
        id: `file-${file.path}`,
        label: file.path,
        group: "Files",
        onAction: () => handleSelectFile(file.path),
      });
    }

    // Threads
    for (const thread of threads) {
      const anchor = thread.anchor as {
        path?: string;
        filePath?: string;
        line?: number;
      };
      const filePath = anchor.path ?? anchor.filePath ?? "";
      const line = anchor.line ?? "";
      const preview = thread.messages[0]?.text?.slice(0, 60) ?? "Thread";
      items.push({
        id: `thread-${thread.id}`,
        label: `${filePath}:${line} — ${preview}`,
        group: "Threads",
        onAction: () => {
          if (filePath) handleSelectFile(filePath);
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
  }, [diffFiles, threads, handleSelectFile]);

  // -------------------------------------------------------------------------
  // Render helpers for DiffViewWrapper
  // -------------------------------------------------------------------------

  const renderWidget = useCallback(
    ({
      lineNumber,
      side,
      onClose,
    }: {
      lineNumber: number;
      side: "old" | "new";
      onClose: () => void;
    }) => {
      if (
        !composingAt ||
        composingAt.lineNumber !== lineNumber ||
        composingAt.side !== side
      ) {
        return null;
      }
      return (
        <ComposeWidget
          lineNumber={lineNumber}
          side={side}
          filePath={effectiveSelectedFile ?? ""}
          onSubmit={handleComposeSubmit}
          onClose={() => {
            setComposingAt(null);
            onClose();
          }}
          quotedText={composingAt.selectedText}
        />
      );
    },
    [composingAt, effectiveSelectedFile, handleComposeSubmit],
  );

  const renderThreads = useCallback(
    ({
      threads: lineThreads,
    }: {
      threads: ReviewThread[];
      lineNumber: number;
      side: "old" | "new";
    }) => {
      return (
        <ThreadDisplay
          threads={lineThreads}
          onReply={handleReply}
          onStatusChange={handleThreadStatusChange}
        />
      );
    },
    [handleReply, handleThreadStatusChange],
  );

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

  if (loading) {
    return (
      <div className="flex h-full bg-[var(--bg-base)]">
        <DiffSkeleton />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

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
  // Empty state — no diff data
  // -------------------------------------------------------------------------

  if (diffFiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <svg
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <span className="text-sm">No diff data available</span>
          <span className="text-xs text-slate-600">
            The code review session has no committed or uncommitted changes yet.
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — 3-column layout
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Branch info bar */}
      {session && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--bg-elevated)] bg-[var(--bg-surface)] px-4 py-1.5">
          <svg
            className="h-3.5 w-3.5 text-slate-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
          </svg>
          {/* Source branch — static label */}
          <span className="rounded bg-[var(--bg-base)] px-2 py-0.5 font-mono text-[11px] text-[var(--accent-blue-text)]">
            {session.sourceBranch}
          </span>
          <svg
            className="h-3 w-3 text-slate-600"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
          </svg>
          {/* Target branch — clickable dropdown */}
          <div ref={branchDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setBranchDropdownOpen((o) => !o)}
              disabled={switching}
              className="flex items-center gap-1 rounded bg-[var(--bg-base)] px-2 py-0.5 font-mono text-[11px] text-slate-400 transition-colors hover:bg-[var(--bg-elevated)] hover:text-slate-200 disabled:opacity-50"
            >
              {switching ? "Switching..." : session.targetBranch}
              <svg
                className={`h-2.5 w-2.5 text-slate-600 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M2.22 4.22a.75.75 0 0 1 1.06 0L6 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L2.22 5.28a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>

            {branchDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg shadow-black/40">
                <div className="border-b border-[var(--bg-elevated)] p-2">
                  <input
                    ref={branchSearchRef}
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Filter branches..."
                    className="w-full rounded bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none ring-1 ring-[var(--border-default)] focus:ring-[var(--accent-blue)]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredBranches.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-slate-600">
                      No branches found
                    </div>
                  ) : (
                    filteredBranches.map((branch) => (
                      <button
                        key={branch}
                        type="button"
                        onClick={() => void handleSwitchTargetBranch(branch)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-[var(--bg-elevated)] ${
                          branch === session.targetBranch
                            ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue-text)]"
                            : "text-slate-300"
                        }`}
                      >
                        {branch === session.targetBranch && (
                          <svg
                            className="h-3 w-3 shrink-0 text-[var(--accent-blue-text)]"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                          </svg>
                        )}
                        <span className="truncate">{branch}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <span className="ml-2 text-[10px] text-slate-600">
            {diffFiles.length} file{diffFiles.length !== 1 ? "s" : ""} changed
          </span>
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar — FileSidebar */}
        <div className="w-[240px] shrink-0 overflow-hidden border-r border-slate-700/50">
          <FileSidebar
            files={diffFiles}
            selectedFile={effectiveSelectedFile}
            onSelectFile={handleSelectFile}
            threadCountByFile={threadCountByFile}
          />
        </div>

        {/* Center — DiffViewWrapper */}
        <div
          ref={diffContainerRef}
          className="relative min-w-0 flex-1 overflow-auto"
        >
          <DiffSelectionPopover
            containerRef={diffContainerRef}
            onComment={handleSelectionComment}
          />
          {selectedDiffFile && (
            <div className="min-h-full">
              {/* File header */}
              <div className="sticky top-0 z-10 border-b border-slate-700/50 bg-[var(--bg-surface)] px-4 py-2">
                <span className="font-mono text-xs text-slate-300">
                  {selectedDiffFile.path}
                </span>
                <span className="ml-2 text-[10px] text-slate-600">
                  {selectedDiffFile.hunks.length} hunk
                  {selectedDiffFile.hunks.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Diff view */}
              <DiffViewWrapper
                hunks={rawHunks}
                fileName={selectedDiffFile.path}
                mode="split"
                enableComments
                onAddComment={handleAddComment}
                renderWidget={renderWidget}
                threadsByLine={threadsByLine}
                renderThreads={renderThreads}
              />
            </div>
          )}
        </div>

        {/* Right sidebar — ThreadPanel */}
        <div className="w-[320px] shrink-0 overflow-hidden border-l border-slate-700/50">
          <ThreadPanel
            threads={threads}
            selectedFile={effectiveSelectedFile}
            session={session}
            onVerdictChange={handleVerdictChange}
            onReply={handleReply}
            onStatusChange={handleThreadStatusChange}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
