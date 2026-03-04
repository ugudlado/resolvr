import {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  localReviewApi,
  type ReviewThread,
  type ReviewMessage,
  type ReviewSession,
} from "../services/localReviewApi";
import { canonicalSessionFileName, uid } from "../utils/diffUtils";

interface UseReviewSessionParams {
  sourceBranch: string;
  targetBranch: string;
  selectedWorktree: string;
  viewKey: string;
}

interface UseReviewSessionResult {
  threads: ReviewThread[];
  setThreads: Dispatch<SetStateAction<ReviewThread[]>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  summaryNotes: string;
  setSummaryNotes: Dispatch<SetStateAction<string>>;
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  resetSession: () => Promise<void>;
  addReply: (threadId: string, text?: string) => void;
  updateThreadStatus: (
    threadId: string,
    nextStatus: ReviewThread["status"],
  ) => void;
  reviewVerdict: "approved" | "changes_requested" | null;
  setReviewVerdict: Dispatch<
    SetStateAction<"approved" | "changes_requested" | null>
  >;
}

export function useReviewSession({
  sourceBranch,
  targetBranch,
  selectedWorktree,
  viewKey,
}: UseReviewSessionParams): UseReviewSessionResult {
  const [threads, setThreads] = useState<ReviewThread[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [summaryNotes, setSummaryNotes] = useState("");
  const [status, setStatus] = useState("Ready");
  const [currentSessionFileName, setCurrentSessionFileName] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState<
    "approved" | "changes_requested" | null
  >(null);

  // Auto-load session on sourceBranch/targetBranch change
  useEffect(() => {
    if (!sourceBranch || !targetBranch) return;
    let cancelled = false;
    const fileName = canonicalSessionFileName(sourceBranch, targetBranch);
    setCurrentSessionFileName(fileName);

    void (async () => {
      try {
        const sessions = await localReviewApi.listSessions();
        if (cancelled) return;
        if (sessions.includes(fileName)) {
          const session = await localReviewApi.getSession(fileName);
          if (cancelled) return;
          setThreads(session.threads || []);
          setSummaryNotes(session.notes || "");
          // Write to localStorage so the summary notes sync effect reads the correct value
          localStorage.setItem(
            `review.summary.${viewKey}`,
            session.notes || "",
          );
          setReviewVerdict(session.reviewVerdict ?? null);
          setStatus(`Loaded session: ${fileName}`);
        } else {
          setThreads([]);
          // Note: do NOT call setSummaryNotes('') here — let the localStorage effect handle it
        }
      } catch (error) {
        if (!cancelled)
          setStatus(
            error instanceof Error ? error.message : "Failed to load session",
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceBranch, targetBranch]);

  // Summary notes localStorage read effect (on viewKey change)
  useEffect(() => {
    const saved = localStorage.getItem(`review.summary.${viewKey}`);
    setSummaryNotes(saved || "");
  }, [viewKey]);

  // Summary notes localStorage write effect (on viewKey + summaryNotes change)
  useEffect(() => {
    localStorage.setItem(`review.summary.${viewKey}`, summaryNotes);
  }, [viewKey, summaryNotes]);

  // Suppress the next file-watcher update that echoes back our own save.
  // Set to true right before we save; the HMR listener checks & clears it.
  const skipNextUpdate = useRef(false);

  // Auto-save effect (on threads change) + mark echo suppression
  useEffect(() => {
    if (!sourceBranch || !targetBranch) return;
    if (threads.length === 0) return; // never auto-save empty state

    skipNextUpdate.current = true;

    const timer = setTimeout(async () => {
      try {
        const name = canonicalSessionFileName(
          sourceBranch,
          targetBranch,
        ).replace(".json", "");
        await localReviewApi.saveSession({
          name,
          notes: summaryNotes,
          sourceBranch,
          targetBranch,
          worktreePath: selectedWorktree,
          threads,
          reviewVerdict,
        });
      } catch {
        // Silent — auto-save failures should not interrupt the user
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [threads, reviewVerdict]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for external session file changes pushed via Vite HMR WebSocket
  useEffect(() => {
    if (!import.meta.hot) return;
    if (!currentSessionFileName) return;

    const handler = (data: { fileName: string; session: ReviewSession }) => {
      if (data.fileName !== currentSessionFileName) return;

      // Skip echoes from our own saves
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }

      const session = data.session;
      setThreads(session.threads || []);
      setSummaryNotes(session.notes || "");
      setReviewVerdict(session.reviewVerdict ?? null);
      setStatus("Session updated externally");
    };

    import.meta.hot.on("review:session-updated", handler);
    return () => {
      import.meta.hot?.off?.("review:session-updated", handler);
    };
  }, [currentSessionFileName]);

  const resetSession = async () => {
    if (currentSessionFileName) {
      try {
        await localReviewApi.deleteSession(currentSessionFileName);
      } catch {
        // File may not exist yet
      }
    }
    setThreads([]);
    setSummaryNotes("");
    setReviewVerdict(null);
    setStatus("Session reset");
  };

  const addReply = (threadId: string, text?: string) => {
    const draft = (text ?? replyDrafts[threadId] ?? "").trim();
    if (!draft) return;
    const now = new Date().toISOString();
    const message: ReviewMessage = {
      id: uid(),
      authorType: "human",
      author: "reviewer",
      text: draft,
      createdAt: now,
    };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, message], lastUpdatedAt: now }
          : t,
      ),
    );
    setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
  };

  const updateThreadStatus = (
    threadId: string,
    nextStatus: ReviewThread["status"],
  ) => {
    const now = new Date().toISOString();
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, status: nextStatus, lastUpdatedAt: now }
          : t,
      ),
    );
  };

  return {
    threads,
    setThreads,
    replyDrafts,
    setReplyDrafts,
    summaryNotes,
    setSummaryNotes,
    status,
    setStatus,
    resetSession,
    addReply,
    updateThreadStatus,
    reviewVerdict,
    setReviewVerdict,
  };
}
