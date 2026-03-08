import {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { wsOn } from "./wsClient";
import {
  type ReviewThread,
  type ReviewMessage,
} from "../services/localReviewApi";
import { featureApi } from "../services/featureApi";
import { AuthorType } from "../types/sessions";
import { REVIEW_VERDICT, THREAD_STATUS } from "../types/constants";
import { uid } from "../utils/diffUtils";

interface UseReviewSessionParams {
  featureId: string;
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
  featureId,
  sourceBranch,
  targetBranch,
  selectedWorktree,
  viewKey,
}: UseReviewSessionParams): UseReviewSessionResult {
  const [threads, setThreads] = useState<ReviewThread[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [summaryNotes, setSummaryNotes] = useState("");
  const [status, setStatus] = useState("Ready");
  const [reviewVerdict, setReviewVerdict] = useState<
    "approved" | "changes_requested" | null
  >(null);

  // Auto-load session when featureId is available
  useEffect(() => {
    if (!featureId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { session } = await featureApi.getCodeSession(featureId);
        if (cancelled) return;
        if (session) {
          setThreads((session.threads as unknown as ReviewThread[]) || []);
          setReviewVerdict(session.reviewVerdict ?? null);
          setStatus(`Loaded session`);
        } else {
          setThreads([]);
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
  }, [featureId]);

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
  const skipNextUpdate = useRef(false);

  // Auto-save effect (on threads/verdict change)
  useEffect(() => {
    if (!featureId || !sourceBranch || !targetBranch) return;
    if (threads.length === 0 && reviewVerdict === null) return; // never auto-save empty state

    const now = new Date().toISOString();
    const timer = setTimeout(async () => {
      skipNextUpdate.current = true;
      try {
        await featureApi.saveCodeSession(featureId, {
          featureId,
          worktreePath: selectedWorktree,
          sourceBranch,
          targetBranch,
          verdict: reviewVerdict,
          reviewVerdict,
          threads:
            threads as unknown as import("../types/sessions").ReviewThread[],
          metadata: { createdAt: now, updatedAt: now },
        });
      } catch {
        // Silent — auto-save failures should not interrupt the user
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [threads, reviewVerdict]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-reset "changes_requested" verdict when all threads are resolved
  useEffect(() => {
    if (reviewVerdict !== REVIEW_VERDICT.ChangesRequested) return;
    if (threads.length === 0) return;
    const hasOpenThread = threads.some((t) => t.status === THREAD_STATUS.Open);
    if (!hasOpenThread) {
      setReviewVerdict(null);
    }
  }, [threads, reviewVerdict]);

  // Listen for external session file changes pushed via server WebSocket
  useEffect(() => {
    if (!featureId) return;
    const expectedFileName = `${featureId}-code.json`;

    return wsOn("review:session-updated", (raw) => {
      const data = raw as {
        fileName: string;
        session: Record<string, unknown>;
      };
      if (data.fileName !== expectedFileName) return;

      // Skip echoes from our own saves
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }

      const session = data.session;
      setThreads((session.threads as ReviewThread[]) || []);
      setReviewVerdict(
        (session.reviewVerdict as "approved" | "changes_requested" | null) ??
          null,
      );
      setStatus("Session updated externally");
    });
  }, [featureId]);

  const resetSession = async () => {
    if (featureId) {
      try {
        await featureApi.deleteCodeSession(featureId);
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
      authorType: AuthorType.Human,
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
