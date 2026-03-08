import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CommitInfo,
  localReviewApi,
  type DiffBundle,
  type RepoContext,
  type ReviewMessage,
  type ReviewThread,
} from "../services/localReviewApi";
import { parseUnifiedDiff } from "../utils/diffParser";
import { uid, getLineContent, isThreadOutdated } from "../utils/diffUtils";
import { FileSidebar, FileIcon } from "../components/sidebar/FileSidebar";
import { DiffViewWrapper } from "../components/diff/DiffViewWrapper";
import { ComposeWidget } from "../components/diff/ThreadWidget";
import { DiffInlineThread } from "../components/diff/DiffInlineThread";
import {
  DiffSelectionPopover,
  type DiffSelectionInfo,
} from "../components/diff/DiffSelectionPopover";
import { SelectionComposePortal } from "../components/diff/SelectionComposePortal";
import {
  LineRangeSelector,
  type LineRangeSelection,
} from "../components/diff/LineRangeSelector";
import { useReviewSession } from "../hooks/useReviewSession";
import { ReviewVerdict } from "../components/shared/ReviewVerdict";
import { useDiffNavigation } from "../hooks/useDiffNavigation";
import { useFeatureHeader } from "../hooks/useFeatureHeader";
import { DiffThreadNav } from "../components/diff/DiffThreadNav";
import {
  AuthorType,
  REVIEW_VERDICT,
  type ReviewThread as SessionReviewThread,
} from "../types/sessions";
import { APP_NAME } from "../config/app";
import { featureApi } from "../services/featureApi";

/** Returns a display label for a commit, e.g. "abc1234 Fix the thing". */
function getCommitLabel(commits: CommitInfo[], hash: string): string {
  const commit = commits.find((c) => c.hash === hash);
  return `${commit?.shortHash ?? ""} ${commit?.subject ?? ""}`.trim() || "";
}

/** Searchable branch dropdown. */
function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "Search branches...",
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      query
        ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
        : options,
    [options, query],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[cursor]) select(filtered[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const triggerClass =
    "flex items-center gap-1.5 bg-transparent text-left text-xs font-medium text-[var(--ink)] outline-none";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          setOpen((o) => !o);
          setCursor(options.indexOf(value));
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className="max-w-[180px] truncate">{value || "select…"}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 12 12"
          fill="currentColor"
          className="h-2.5 w-2.5 text-[var(--ink-faint)]"
        >
          <path d="M6 8.825a.47.47 0 0 1-.354-.146l-3.5-3.5a.5.5 0 0 1 .708-.708L6 7.618l3.146-3.147a.5.5 0 0 1 .708.708l-3.5 3.5A.47.47 0 0 1 6 8.825Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-elevated)] shadow-xl shadow-black/30">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--canvas)] px-2 py-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
              >
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1ZM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent text-xs text-[var(--ink)] placeholder-[var(--ink-faint)] outline-none"
              />
            </div>
          </div>
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-[var(--ink-faint)]">
                No matching branches
              </li>
            )}
            {filtered.map((opt, i) => (
              <li
                key={opt}
                onMouseDown={() => select(opt)}
                onMouseEnter={() => setCursor(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  i === cursor
                    ? "bg-[var(--accent-blue-dim)] text-[var(--ink)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center ${opt === value ? "text-[var(--accent-blue)]" : "text-transparent"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                  </svg>
                </span>
                <span
                  className={`truncate font-mono ${opt === value ? "font-medium text-[var(--ink)]" : ""}`}
                >
                  {opt}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface ReviewPageProps {
  /** Feature ID — used to load/save via the new code-session API. */
  featureId?: string;
  /** Pre-set worktree path — hides worktree selector when provided. */
  worktreePath?: string;
  /** Pre-set source branch — overrides session restore and context.currentBranch when provided. */
  sourceBranch?: string;
  /** When true, hides the top "Local Review" title (used when embedded in feature layout). */
  embedded?: boolean;
}

export function ReviewPage({
  featureId,
  worktreePath,
  sourceBranch: sourceBranchProp,
  embedded,
}: ReviewPageProps = {}) {
  const [repoContext, setRepoContext] = useState<RepoContext | null>(null);
  const [selectedWorktree, setSelectedWorktree] = useState(worktreePath ?? "");
  const [sourceBranch, setSourceBranch] = useState(sourceBranchProp ?? "");
  const [targetBranch, setTargetBranch] = useState("main");

  // Sync when props arrive late (e.g. after async feature lookup)
  useEffect(() => {
    if (sourceBranchProp) setSourceBranch(sourceBranchProp);
  }, [sourceBranchProp]);
  useEffect(() => {
    if (worktreePath) setSelectedWorktree(worktreePath);
  }, [worktreePath]);

  const [diffBundle, setDiffBundle] = useState<DiffBundle | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState("");
  const [selectedCommitDiff, setSelectedCommitDiff] = useState("");

  const [showFolderTree, setShowFolderTree] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set(),
  );

  /** Line where the compose widget is open, or null if closed. */
  const [composingAt, setComposingAt] = useState<{
    lineNumber: number;
    startLineNumber?: number;
    side: "old" | "new";
    selectedText?: string;
    /** True when opened via the + button / range selector (uses portal). */
    usePortal?: boolean;
  } | null>(null);

  const [diffMode, setDiffMode] = useState<"split" | "unified">("unified");

  const reviewPanelRef = useRef<HTMLDivElement | null>(null);
  // Track the last viewKey for which we auto-selected a file, so we don't override
  // the user's manual file selection on every render.
  const autoSelectedViewKeyRef = useRef("");

  const activeDiff = selectedCommit
    ? selectedCommitDiff
    : diffBundle?.allDiff || "";
  const parsedFiles = useMemo(() => {
    const files = parseUnifiedDiff(activeDiff);
    // Deduplicate: when allDiff = committedDiff + uncommittedDiff, same file can appear twice.
    // Keep the last occurrence (uncommitted changes are more current).
    const seen = new Map<string, (typeof files)[number]>();
    for (const f of files) seen.set(f.path, f);
    return Array.from(seen.values());
  }, [activeDiff]);
  const viewKey = `${selectedWorktree}|${sourceBranch}|${targetBranch}|${selectedCommit || "all"}`;

  const {
    threads,
    setThreads,
    setStatus,
    addReply,
    updateThreadStatus,
    reviewVerdict,
    setReviewVerdict,
  } = useReviewSession({
    featureId: featureId ?? "",
    sourceBranch,
    targetBranch,
    selectedWorktree,
    viewKey,
  });

  const selectedFile =
    parsedFiles.find((f) => f.path === selectedFilePath) ||
    parsedFiles[0] ||
    null;

  const outdatedThreadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const thread of threads) {
      if (isThreadOutdated(thread, parsedFiles)) ids.add(thread.id);
    }
    return ids;
  }, [threads, parsedFiles]);

  /** Threads for the currently selected file, keyed as "side:line" for DiffViewWrapper. */
  const threadsByLine = useMemo(() => {
    if (!selectedFile) return new Map<string, SessionReviewThread[]>();
    const map = new Map<string, SessionReviewThread[]>();
    for (const thread of threads) {
      if (thread.filePath !== selectedFile.path) continue;
      const line = thread.lineEnd || thread.line;
      const key = `${thread.side}:${line}`;
      // Adapt old thread shape to new SessionReviewThread for DiffViewWrapper
      const adapted: SessionReviewThread = {
        id: thread.id,
        anchor: {
          type: "diff-line",
          hash: "",
          path: thread.filePath,
          preview: thread.anchorContent || `Line ${thread.line}`,
          line: thread.line,
          lineEnd: thread.lineEnd,
          side: thread.side,
        },
        status: thread.status,
        messages: thread.messages,
        lastUpdatedAt: thread.lastUpdatedAt,
      };
      const list = map.get(key) || [];
      list.push(adapted);
      map.set(key, list);
    }
    return map;
  }, [threads, selectedFile]);

  /** Pre-parse the full diff into per-file sections (only re-runs when activeDiff changes). */
  const hunksByFile = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!activeDiff) return map;
    const lines = activeDiff.split("\n");
    let currentPath = "";
    let fileSection: string[] = [];

    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        // Flush previous file section
        if (currentPath && fileSection.length > 0) {
          const existing = map.get(currentPath) || [];
          existing.push(fileSection.join("\n"));
          map.set(currentPath, existing);
          fileSection = [];
        }
        // Extract path from "diff --git a/path b/path" (handles c/, w/ prefixes too)
        // Use non-greedy \S+? so the prefix stops at the first slash (a/, b/, c/, w/)
        const match = line.match(/diff --git \S+?\/(.+) \S+?\/\1/);
        currentPath = match?.[1] ?? "";
        if (currentPath) fileSection = [line];
        continue;
      }
      if (!currentPath) continue;
      fileSection.push(line);
    }
    // Flush last file section
    if (currentPath && fileSection.length > 0) {
      const existing = map.get(currentPath) || [];
      existing.push(fileSection.join("\n"));
      map.set(currentPath, existing);
    }
    return map;
  }, [activeDiff]);

  /** Raw diff sections for the selected file (cheap lookup from pre-parsed map). */
  const selectedFileHunks = selectedFile
    ? (hunksByFile.get(selectedFile.path) ?? [])
    : [];

  const pendingCount = useMemo(
    () => threads.filter((t) => t.status === "open").length,
    [threads],
  );

  const unresolvedThreadCountByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const thread of threads) {
      if (thread.status === "approved") continue;
      if (outdatedThreadIds.has(thread.id)) continue;
      map.set(thread.filePath, (map.get(thread.filePath) || 0) + 1);
    }
    return map;
  }, [threads, outdatedThreadIds]);

  const changeCountByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of parsedFiles) {
      let count = 0;
      for (const hunk of file.hunks)
        for (const line of hunk.lines)
          if (line.kind === "add" || line.kind === "del") count += 1;
      map.set(file.path, count);
    }
    return map;
  }, [parsedFiles]);

  const diffStats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of parsedFiles)
      for (const hunk of file.hunks)
        for (const line of hunk.lines) {
          if (line.kind === "add") additions++;
          else if (line.kind === "del") deletions++;
        }
    return { additions, deletions };
  }, [parsedFiles]);

  const visibleFiles = parsedFiles;

  const applyCommitSelection = async (commitHash: string) => {
    setSelectedCommit(commitHash);
    if (!commitHash) {
      setSelectedCommitDiff("");
      setStatus("Viewing all changes");
      return;
    }
    setStatus(`Loading ${commitHash.slice(0, 7)}...`);
    try {
      const diff = await localReviewApi.getCommitDiff({
        worktreePath: selectedWorktree,
        commit: commitHash,
      });
      setSelectedCommitDiff(diff);
      setStatus(`Commit ${commitHash.slice(0, 7)}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to load commit",
      );
    }
  };

  const refreshRepoContext = async () => {
    try {
      const [context, sessionResult] = await Promise.all([
        localReviewApi.getContext(worktreePath),
        featureId
          ? featureApi.getCodeSession(featureId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setRepoContext(context);

      // When embedded with a specific worktree, use that; otherwise use current
      if (worktreePath) {
        setSelectedWorktree(worktreePath);
      } else {
        setSelectedWorktree(context.currentWorktree);
      }

      const defaultTarget = context.branches.includes("main")
        ? "main"
        : context.defaultTargetBranch;

      // Target always defaults to main — user can switch if needed
      setTargetBranch(defaultTarget);

      // Source priority: pre-set prop > recent session > git context
      if (sourceBranchProp) {
        setSourceBranch(sourceBranchProp);
      } else if (sessionResult?.session?.sourceBranch) {
        setSourceBranch(sessionResult.session.sourceBranch);
      } else {
        setSourceBranch(context.currentBranch);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to load repo context",
      );
    }
  };

  const refreshDiffBundle = async (
    worktreePath: string,
    source: string,
    target: string,
  ) => {
    if (!worktreePath || !source || !target) return;
    setStatus(`Diffing ${source} ← ${target}...`);
    try {
      const bundle = await localReviewApi.getDiffBundle({
        worktreePath,
        sourceBranch: source,
        targetBranch: target,
      });
      setDiffBundle(bundle);
      setSelectedCommit("");
      setSelectedCommitDiff("");
      setStatus(`${bundle.sourceBranch} → ${bundle.targetBranch}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load diff");
    }
  };

  const refreshCommits = async (
    worktreePath: string,
    source: string,
    target: string,
  ) => {
    if (!worktreePath || !source || !target) return;
    try {
      const commitList = await localReviewApi.getCommits({
        worktreePath,
        sourceBranch: source,
        targetBranch: target,
      });
      setCommits(commitList);
    } catch {
      setCommits([]);
    }
  };

  /** Called when user clicks "+" on a diff line to open the compose widget. */
  const handleAddComment = useCallback(
    (lineNumber: number, side: "old" | "new") => {
      setComposingAt({ lineNumber, side });
    },
    [],
  );

  /** Called when user selects text in the diff and clicks "Comment". */
  const handleSelectionComment = useCallback((info: DiffSelectionInfo) => {
    setComposingAt({
      lineNumber: info.lineNumber,
      startLineNumber: info.startLineNumber,
      side: info.side,
      selectedText: info.text,
    });
  }, []);

  /** Called when user click+drags on the + button to select a range. */
  const handleLineRangeComment = useCallback((sel: LineRangeSelection) => {
    setComposingAt({
      lineNumber: sel.endLine,
      startLineNumber:
        sel.startLine !== sel.endLine ? sel.startLine : undefined,
      side: sel.side,
      usePortal: true,
    });
  }, []);

  /** Called when the compose widget submits a new thread. */
  const handleComposeSubmit = useCallback(
    (
      anchor: {
        path: string;
        line: number;
        lineEnd?: number;
        side: "old" | "new";
      },
      text: string,
    ) => {
      const now = new Date().toISOString();
      const message: ReviewMessage = {
        id: uid(),
        authorType: AuthorType.Human,
        author: "reviewer",
        text,
        createdAt: now,
      };
      const thread: ReviewThread = {
        id: uid(),
        filePath: anchor.path,
        line: anchor.line,
        lineEnd: anchor.lineEnd,
        side: anchor.side,
        anchorContent: getLineContent(
          parsedFiles,
          anchor.path,
          anchor.line,
          anchor.side,
        ),
        status: "open",
        messages: [message],
        lastUpdatedAt: now,
      };
      setThreads((prev) => [...prev, thread]);
      setComposingAt(null);
    },
    [parsedFiles, setThreads],
  );

  useEffect(() => {
    void refreshRepoContext();
  }, []);

  useEffect(() => {
    if (!selectedWorktree || !sourceBranch || !targetBranch) return;
    void refreshDiffBundle(selectedWorktree, sourceBranch, targetBranch);
    void refreshCommits(selectedWorktree, sourceBranch, targetBranch);
  }, [selectedWorktree, sourceBranch, targetBranch]);

  useEffect(() => {
    // Only auto-select when the view (branch/commit combo) actually changes, not on every
    // manual file click. Without this guard, selectedFilePath in deps causes a render loop.
    if (autoSelectedViewKeyRef.current === viewKey) return;
    autoSelectedViewKeyRef.current = viewKey;

    if (!visibleFiles.length) {
      setSelectedFilePath("");
      return;
    }

    const persisted = localStorage.getItem(`review.selectedFile.${viewKey}`);
    if (persisted && visibleFiles.some((f) => f.path === persisted)) {
      setSelectedFilePath(persisted);
      return;
    }
    setSelectedFilePath(visibleFiles[0].path);
  }, [visibleFiles, viewKey]);

  useEffect(() => {
    if (!selectedFilePath) return;
    localStorage.setItem(`review.selectedFile.${viewKey}`, selectedFilePath);
  }, [viewKey, selectedFilePath]);

  useDiffNavigation({
    commits,
    selectedCommit,
    onCommitChange: (h) => void applyCommitSelection(h),
  });

  const handleApprove = () => {
    setReviewVerdict(REVIEW_VERDICT.Approved);
  };

  const handleRequestChanges = () => {
    setReviewVerdict(REVIEW_VERDICT.ChangesRequested);
    // Trigger resolve directly — the daemon is already warm from cold-start
    if (featureId) {
      featureApi.triggerResolve(featureId, "code").catch((err) => {
        setStatus(
          err instanceof Error ? err.message : "Failed to trigger resolve",
        );
      });
    }
  };

  // Inject verdict into FeatureNavBar when embedded
  const { setHeaderActions } = useFeatureHeader();

  useEffect(() => {
    if (!embedded) return;
    setHeaderActions(
      <div className="flex items-center gap-2">
        <ReviewVerdict
          verdict={reviewVerdict}
          onVerdictChange={(v) => {
            if (v === REVIEW_VERDICT.Approved) handleApprove();
            else handleRequestChanges();
          }}
          openThreadCount={pendingCount}
        />
      </div>,
    );
  }, [embedded, reviewVerdict, pendingCount, setHeaderActions]);

  // Clean up header actions on unmount
  useEffect(() => {
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  useEffect(() => {
    const panel = reviewPanelRef.current;
    if (!panel || !selectedFilePath) return;
    const scrollKey = `review.scroll.${viewKey}|${selectedFilePath}`;
    panel.scrollTop = Number(localStorage.getItem(scrollKey)) || 0;
    const onScroll = () =>
      localStorage.setItem(scrollKey, String(panel.scrollTop));
    panel.addEventListener("scroll", onScroll);
    return () => panel.removeEventListener("scroll", onScroll);
  }, [viewKey, selectedFilePath]);

  return (
    <div
      className={`flex flex-col bg-[var(--canvas)] text-[var(--ink)] ${embedded ? "h-full" : "h-screen"}`}
    >
      {/* Top toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--canvas-raised)] px-4 py-2.5">
        {!embedded && (
          <span className="mr-1 text-sm font-semibold text-[var(--ink)]">
            {APP_NAME}
          </span>
        )}

        {embedded ? (
          <>
            <span className="rounded-md border border-[var(--border)] bg-[var(--canvas)] px-2 py-1 text-xs text-[var(--ink)]">
              {sourceBranch || "..."}
            </span>
            <span className="text-[var(--ink-ghost)]">&rarr;</span>
          </>
        ) : (
          <>
            <div className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--canvas)] px-2 py-1">
              <span className="text-[10px] text-[var(--ink-faint)]">
                compare
              </span>
              <SearchSelect
                value={sourceBranch}
                options={repoContext?.branches || []}
                onChange={setSourceBranch}
                placeholder="Filter branches…"
              />
            </div>
            <span className="text-[var(--ink-ghost)]">&rarr;</span>
          </>
        )}

        <div className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--canvas)] px-2 py-1">
          <span className="text-[10px] text-[var(--ink-faint)]">base</span>
          <SearchSelect
            value={targetBranch}
            options={repoContext?.branches || []}
            onChange={setTargetBranch}
            placeholder="Filter branches…"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--canvas)] px-2 py-1">
          <span className="text-[10px] text-[var(--ink-faint)]">commit</span>
          <SearchSelect
            value={
              selectedCommit
                ? getCommitLabel(commits, selectedCommit)
                : "All changes"
            }
            options={[
              "All changes",
              ...commits.map((c) => `${c.shortHash} ${c.subject}`),
            ]}
            onChange={(display) => {
              if (display === "All changes") {
                void applyCommitSelection("");
              } else {
                const commit = commits.find(
                  (c) => `${c.shortHash} ${c.subject}` === display,
                );
                if (commit) void applyCommitSelection(commit.hash);
              }
            }}
            placeholder="Filter commits…"
          />
          <button
            type="button"
            onClick={() => {
              if (!selectedCommit) return;
              const idx = commits.findIndex((c) => c.hash === selectedCommit);
              void applyCommitSelection(idx <= 0 ? "" : commits[idx - 1].hash);
            }}
            className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
            title="Previous commit [ key"
            aria-label="Previous commit [ key"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              if (!commits.length) return;
              if (!selectedCommit) {
                void applyCommitSelection(commits[0].hash);
                return;
              }
              const idx = commits.findIndex((c) => c.hash === selectedCommit);
              if (idx < commits.length - 1)
                void applyCommitSelection(commits[idx + 1].hash);
            }}
            className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
            title="Next commit ] key"
            aria-label="Next commit ] key"
          >
            ›
          </button>
        </div>

        {/* Diff stats */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-faint)]">
          <span>{visibleFiles.length} files</span>
          <span className="text-[var(--accent-emerald)]">
            +{diffStats.additions}
          </span>
          <span className="text-[var(--accent-rose)]">
            &minus;{diffStats.deletions}
          </span>
        </div>

        {/* Copy branch name */}
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-faint)] transition-colors hover:bg-[var(--canvas)] hover:text-[var(--ink-muted)]"
          title="Copy branch name"
          onClick={() => {
            navigator.clipboard.writeText(sourceBranch);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 shrink-0"
          >
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
          </svg>
          {sourceBranch}
        </button>

        {!embedded && (
          <div className="ml-auto flex items-center gap-2">
            {reviewVerdict === REVIEW_VERDICT.Approved && (
              <span className="rounded-full bg-[var(--accent-emerald-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-emerald)]">
                Approved
              </span>
            )}
            {reviewVerdict === REVIEW_VERDICT.ChangesRequested && (
              <span className="rounded-full bg-[var(--accent-rose-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-rose)]">
                Changes Requested
              </span>
            )}
            <ReviewVerdict
              verdict={reviewVerdict}
              onVerdictChange={(v) => {
                if (v === REVIEW_VERDICT.Approved) handleApprove();
                else handleRequestChanges();
              }}
              openThreadCount={pendingCount}
            />
          </div>
        )}
      </header>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* File sidebar */}
        <FileSidebar
          hideOverviewTab
          leftTab="files"
          pendingCount={pendingCount}
          visibleFiles={visibleFiles}
          selectedFilePath={selectedFilePath}
          onFileSelect={setSelectedFilePath}
          showFolderTree={showFolderTree}
          onFolderTreeChange={setShowFolderTree}
          collapsedFolders={collapsedFolders}
          onFolderToggle={(path) => {
            setCollapsedFolders((prev) => {
              const next = new Set(prev);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              return next;
            });
          }}
          unresolvedThreadCountByFile={unresolvedThreadCountByFile}
          changeCountByFile={changeCountByFile}
        />

        {/* Diff panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedFile ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--ink-ghost)]">
              Select a file to review
            </div>
          ) : (
            <>
              {/* File header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--canvas-raised)] px-4 py-2">
                <FileIcon status={selectedFile.status} />
                <span className="font-[family-name:JetBrains_Mono,monospace] text-sm text-[var(--ink)]">
                  {selectedFile.path}
                </span>
                <span className="ml-auto text-xs text-[var(--ink-ghost)]">
                  {changeCountByFile.get(selectedFile.path) || 0} changes
                </span>
                <button
                  className={`ml-2 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    diffMode === "unified"
                      ? "bg-[var(--canvas-elevated)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
                  }`}
                  onClick={() => setDiffMode("unified")}
                >
                  Unified
                </button>
                <button
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    diffMode === "split"
                      ? "bg-[var(--canvas-elevated)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
                  }`}
                  onClick={() => setDiffMode("split")}
                >
                  Split
                </button>
              </div>

              {/* Diff content via @git-diff-view/react */}
              <div
                ref={reviewPanelRef}
                className="relative min-h-0 flex-1 overflow-auto"
              >
                <DiffSelectionPopover
                  containerRef={reviewPanelRef}
                  onComment={handleSelectionComment}
                />
                <LineRangeSelector
                  containerRef={reviewPanelRef}
                  onComment={handleLineRangeComment}
                />
                <DiffViewWrapper
                  hunks={selectedFileHunks}
                  fileName={selectedFile.path}
                  mode={diffMode}
                  enableComments
                  onAddComment={handleAddComment}
                  threadsByLine={threadsByLine}
                  renderWidget={({ lineNumber, side, onClose }) =>
                    composingAt?.lineNumber === lineNumber &&
                    composingAt?.side === side &&
                    !composingAt?.selectedText &&
                    !composingAt?.startLineNumber &&
                    !composingAt?.usePortal ? (
                      <ComposeWidget
                        lineNumber={lineNumber}
                        side={side}
                        filePath={selectedFile.path}
                        onSubmit={(anchor, text) => {
                          handleComposeSubmit(anchor, text);
                          onClose();
                        }}
                        onClose={() => {
                          setComposingAt(null);
                          onClose();
                        }}
                      />
                    ) : null
                  }
                  renderThreads={({ threads: lineThreads }) => (
                    <div>
                      {lineThreads.map((t) => (
                        <DiffInlineThread
                          key={t.id}
                          thread={t}
                          onReply={(threadId, text) => addReply(threadId, text)}
                          onStatusChange={(threadId, newStatus) =>
                            updateThreadStatus(threadId, newStatus)
                          }
                        />
                      ))}
                    </div>
                  )}
                  wrap={false}
                  fontSize={13}
                />
                {/* Portal-based compose for text-selection or line-range comments */}
                {(composingAt?.selectedText ||
                  composingAt?.startLineNumber ||
                  composingAt?.usePortal) &&
                  selectedFile && (
                    <SelectionComposePortal
                      containerRef={reviewPanelRef}
                      lineNumber={composingAt.lineNumber}
                      startLineNumber={composingAt.startLineNumber}
                      side={composingAt.side}
                      filePath={selectedFile.path}
                      selectedText={composingAt.selectedText ?? ""}
                      onSubmit={(anchor, text) => {
                        handleComposeSubmit(anchor, text);
                      }}
                      onClose={() => setComposingAt(null)}
                    />
                  )}
              </div>
            </>
          )}
        </div>

        {/* Right panel — threads */}
        <DiffThreadNav
          threads={threads}
          onThreadClick={(thread) => {
            setSelectedFilePath(thread.filePath);
            // After file switch + re-render, scroll to the thread's line
            const targetLine = thread.lineEnd || thread.line;
            const side = thread.side || "new";
            const attr =
              side === "new" ? "data-line-new-num" : "data-line-old-num";
            const scrollToLine = () => {
              const panel = reviewPanelRef.current;
              if (!panel) return;
              const rows = panel.querySelectorAll(
                `tr.diff-line[data-state="diff"]`,
              );
              for (const row of rows) {
                const span = row.querySelector(`[${attr}]`);
                if (!span) continue;
                const num = parseInt(span.getAttribute(attr) ?? "", 10);
                if (num === targetLine) {
                  row.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  // Brief highlight flash
                  row.classList.add("line-range-highlight");
                  setTimeout(
                    () => row.classList.remove("line-range-highlight"),
                    2000,
                  );
                  return;
                }
              }
            };
            // Wait for diff to render after file switch
            requestAnimationFrame(() => requestAnimationFrame(scrollToLine));
          }}
        />
      </div>
    </div>
  );
}
