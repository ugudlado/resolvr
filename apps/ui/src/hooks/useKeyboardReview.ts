import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewThread } from "../services/localReviewApi";
import { THREAD_STATUS, type ThreadStatus } from "../types/constants";
import { isClosed } from "../utils/threadStatus";
import { isInputFocused } from "../utils/keyboardUtils";

export interface UseKeyboardReviewOptions {
  files: string[];
  threads: ReviewThread[];
  selectedFile: string | null;
  sidebarRef: React.RefObject<HTMLElement | null>;
  diffPanelRef: React.RefObject<HTMLElement | null>;
  /** When true, headless-tree owns arrow/Enter navigation — hook skips those keys. */
  treeViewActive: boolean;
  onFileSelect: (path: string) => void;
  onThreadFocus: (thread: ReviewThread) => void;
  onThreadStatusChange: (threadId: string, status: ThreadStatus) => void;
  onOpenPalette: () => void;
}

export interface UseKeyboardReviewReturn {
  selectedFileIndex: number;
  setSelectedFileIndex: (index: number) => void;
  focusedThreadIndex: number;
  focusedThread: ReviewThread | null;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

export function useKeyboardReview({
  files,
  threads,
  selectedFile,
  sidebarRef,
  diffPanelRef,
  treeViewActive,
  onFileSelect,
  onThreadFocus,
  onThreadStatusChange,
  onOpenPalette,
}: UseKeyboardReviewOptions): UseKeyboardReviewReturn {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [focusedThreadIndex, setFocusedThreadIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Mutable refs that update synchronously — prevents stale reads on rapid keypresses
  const fileIdxRef = useRef(0);
  const threadIdxRef = useRef(0);
  const helpRef = useRef(false);

  const syncFileIndex = (idx: number) => {
    fileIdxRef.current = idx;
    setSelectedFileIndex(idx);
  };

  const syncThreadIndex = (idx: number) => {
    threadIdxRef.current = idx;
    setFocusedThreadIndex(idx);
  };

  const syncShowHelp = (show: boolean) => {
    helpRef.current = show;
    setShowHelp(show);
  };

  // Keep index in sync when selected file changes from mouse clicks
  useEffect(() => {
    if (!selectedFile) return;
    const idx = files.indexOf(selectedFile);
    if (idx !== -1 && idx !== fileIdxRef.current) {
      syncFileIndex(idx);
    }
  }, [selectedFile, files]);

  // Reset thread index when file changes
  useEffect(() => {
    syncThreadIndex(0);
  }, [selectedFile]);

  // Clamp indices when lists change
  useEffect(() => {
    if (files.length === 0) {
      syncFileIndex(0);
    } else if (fileIdxRef.current >= files.length) {
      syncFileIndex(files.length - 1);
    }
  }, [files.length]);

  useEffect(() => {
    if (threads.length === 0) {
      syncThreadIndex(0);
    } else if (threadIdxRef.current >= threads.length) {
      syncThreadIndex(threads.length - 1);
    }
  }, [threads.length]);

  const focusedThread =
    threads.length > 0 ? (threads[focusedThreadIndex] ?? null) : null;

  // Keep callbacks and data fresh via refs — assigned during render intentionally
  // so the keydown handler always reads the latest values without re-subscribing.
  const callbacksRef = useRef({
    onFileSelect,
    onThreadFocus,
    onThreadStatusChange,
    onOpenPalette,
  });
  // eslint-disable-next-line react-hooks/refs
  callbacksRef.current = {
    onFileSelect,
    onThreadFocus,
    onThreadStatusChange,
    onOpenPalette,
  };

  const dataRef = useRef({ files, threads });
  // eslint-disable-next-line react-hooks/refs
  dataRef.current = { files, threads };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const { files, threads } = dataRef.current;
      const cbs = callbacksRef.current;

      // Escape — close help modal if open (before input guard)
      if (e.key === "Escape" && helpRef.current) {
        syncShowHelp(false);
        return;
      }

      // Ctrl+K / Cmd+K — open command palette (before input guard)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        cbs.onOpenPalette();
        return;
      }

      const isSidebarFocused =
        sidebarRef.current?.contains(document.activeElement) ?? false;

      // Arrow keys: only fire when sidebar has focus AND tree view is not active
      // (headless-tree handles its own arrow/Enter navigation)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!isSidebarFocused || treeViewActive) return;
        e.preventDefault();
        const cur = fileIdxRef.current;
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(cur + 1, files.length - 1)
            : Math.max(cur - 1, 0);
        syncFileIndex(nextIdx);
        // Move focus to the sidebar container BEFORE the re-render so child
        // button unmounts don't shift focus to <body>.
        sidebarRef.current?.focus();
        if (files[nextIdx]) cbs.onFileSelect(files[nextIdx]);
        return;
      }

      // Enter: open the keyboard-selected file and focus diff panel
      if (e.key === "Enter") {
        if (!isSidebarFocused || treeViewActive) return;
        e.preventDefault();
        const cur = fileIdxRef.current;
        if (files[cur]) cbs.onFileSelect(files[cur]);
        // Focus diff panel so user can scroll immediately
        requestAnimationFrame(() => diffPanelRef.current?.focus());
        return;
      }

      // Letter keys: suppressed when any input is focused
      if (isInputFocused()) return;

      switch (e.key) {
        case "j": {
          if (threads.length === 0) return;
          const next = Math.min(threadIdxRef.current + 1, threads.length - 1);
          syncThreadIndex(next);
          if (threads[next]) cbs.onThreadFocus(threads[next]);
          break;
        }
        case "k": {
          if (threads.length === 0) return;
          const prev = Math.max(threadIdxRef.current - 1, 0);
          syncThreadIndex(prev);
          if (threads[prev]) cbs.onThreadFocus(threads[prev]);
          break;
        }
        case "r": {
          const t =
            threads.length > 0 ? (threads[threadIdxRef.current] ?? null) : null;
          if (t?.status === THREAD_STATUS.Open)
            cbs.onThreadStatusChange(t.id, THREAD_STATUS.Resolved);
          break;
        }
        case "o": {
          const t =
            threads.length > 0 ? (threads[threadIdxRef.current] ?? null) : null;
          if (t && isClosed(t.status))
            cbs.onThreadStatusChange(t.id, THREAD_STATUS.Open);
          break;
        }
        case "w": {
          const t =
            threads.length > 0 ? (threads[threadIdxRef.current] ?? null) : null;
          if (t?.status === THREAD_STATUS.Open)
            cbs.onThreadStatusChange(t.id, THREAD_STATUS.WontFix);
          break;
        }
        case "d": {
          const t =
            threads.length > 0 ? (threads[threadIdxRef.current] ?? null) : null;
          if (t?.status === THREAD_STATUS.Open)
            cbs.onThreadStatusChange(t.id, THREAD_STATUS.Outdated);
          break;
        }
        case "h": {
          // In tree view, focus the tree container so headless-tree gets arrow keys
          const tree = sidebarRef.current?.querySelector('[role="tree"]');
          if (tree instanceof HTMLElement) {
            tree.focus();
          } else {
            sidebarRef.current?.focus();
          }
          break;
        }
        case "l":
          diffPanelRef.current?.focus();
          break;
        case "?":
          syncShowHelp(!helpRef.current);
          break;
      }
    },
    [sidebarRef, diffPanelRef, treeViewActive],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    selectedFileIndex,
    setSelectedFileIndex: syncFileIndex,
    focusedThreadIndex,
    focusedThread,
    showHelp,
    setShowHelp: syncShowHelp,
  };
}
