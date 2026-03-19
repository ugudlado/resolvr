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
import {
  AuthorType,
  type ReviewThread as SessionReviewThread,
} from "../types/sessions";

import { uid } from "../utils/diffUtils";

/**
 * Adapt a session thread (canonical anchor format) to the flat ReviewThread
 * format used by the browser UI. Threads may already be in flat format (created
 * by the browser) or in anchor format (created by the VS Code extension).
 */
function adaptThread(raw: Record<string, unknown>): ReviewThread {
  // Already in flat format — has filePath at top level
  if (typeof raw.filePath === "string") {
    return raw as unknown as ReviewThread;
  }

  // Canonical anchor format — map anchor fields to flat fields
  const anchor = raw.anchor as
    | {
        path?: string;
        line?: number;
        lineEnd?: number;
        side?: string;
        preview?: string;
      }
    | undefined;

  return {
    ...(raw as unknown as ReviewThread),
    filePath: anchor?.path ?? "",
    line: anchor?.line ?? 0,
    lineEnd: anchor?.lineEnd,
    side: (anchor?.side as "old" | "new") ?? "new",
    anchorContent: anchor?.preview,
  };
}

function adaptThreads(raw: unknown[]): ReviewThread[] {
  return (raw ?? []).map((t) => adaptThread(t as Record<string, unknown>));
}

interface UseReviewSessionParams {
  featureId: string;
  sourceBranch: string;
  targetBranch: string;
  selectedWorktree: string;
  viewKey: string;
  /** Called after the session is successfully saved to the server (e.g. after thread status changes). */
  onSessionSaved?: () => void;
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
  reviewVerdict: "changes_requested" | null;
  setReviewVerdict: Dispatch<SetStateAction<"changes_requested" | null>>;
}

export function useReviewSession({
  featureId,
  sourceBranch,
  targetBranch,
  selectedWorktree,
  viewKey,
  onSessionSaved,
}: UseReviewSessionParams): UseReviewSessionResult {
  // Keep callback in a ref to avoid triggering the auto-save effect
  const onSessionSavedRef = useRef(onSessionSaved);
  useEffect(() => {
    onSessionSavedRef.current = onSessionSaved;
  });
  const [threads, setThreads] = useState<ReviewThread[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [summaryNotes, setSummaryNotes] = useState("");
  const [status, setStatus] = useState("Ready");
  const [reviewVerdict, setReviewVerdict] = useState<
    "changes_requested" | null
  >(null);

  // Auto-load session when featureId or sourceBranch changes.
  // Only apply threads if the session's source branch matches the current one.
  useEffect(() => {
    if (!featureId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { session } = await featureApi.getCodeSession(featureId);
        if (cancelled) return;
        if (session) {
          // Only show threads for the matching branch
          const branchMatches =
            !sourceBranch ||
            !session.sourceBranch ||
            session.sourceBranch === sourceBranch;
          if (branchMatches) {
            setThreads(adaptThreads(session.threads ?? []));
            setReviewVerdict(session.reviewVerdict ?? null);
            const meta = session.metadata as { createdAt?: string } | undefined;
            createdAtRef.current = meta?.createdAt ?? null;
            setStatus(`Loaded session`);
          } else {
            setThreads([]);
            setReviewVerdict(null);
            setStatus("Ready");
          }
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
  }, [featureId, sourceBranch]);

  // Summary notes localStorage read effect (on viewKey change)
  useEffect(() => {
    const saved = localStorage.getItem(`review.summary.${viewKey}`);
    setSummaryNotes(saved ?? "");
  }, [viewKey]);

  // Summary notes localStorage write effect (on viewKey + summaryNotes change)
  useEffect(() => {
    localStorage.setItem(`review.summary.${viewKey}`, summaryNotes);
  }, [viewKey, summaryNotes]);

  // Preserve original session creation timestamp across auto-saves.
  const createdAtRef = useRef<string | null>(null);

  // Suppress the next file-watcher update that echoes back our own save.
  const skipNextUpdate = useRef(false);

  // Auto-save effect (on threads/verdict change)
  useEffect(() => {
    if (!featureId || !sourceBranch || !targetBranch) return;
    if (threads.length === 0 && reviewVerdict === null) return; // never auto-save empty state

    const now = new Date().toISOString();
    const createdAt = createdAtRef.current ?? now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    createdAtRef.current = createdAt;

    const timer = setTimeout(() => {
      void (async () => {
        skipNextUpdate.current = true;
        try {
          await featureApi.saveCodeSession(featureId, {
            featureId,
            worktreePath: selectedWorktree,
            sourceBranch,
            targetBranch,
            verdict: reviewVerdict,
            reviewVerdict,
            threads: threads as unknown as SessionReviewThread[],
            metadata: { createdAt, updatedAt: now },
          });
          onSessionSavedRef.current?.();
        } catch {
          // Silent — auto-save failures should not interrupt the user
        }
      })();
    }, 200);

    return () => clearTimeout(timer);
  }, [threads, reviewVerdict]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setThreads(adaptThreads((session.threads as unknown[]) ?? []));
      setReviewVerdict(
        (session.reviewVerdict as "changes_requested" | null) ?? null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    createdAtRef.current = null;
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
