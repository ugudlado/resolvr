import { useState, useEffect, useRef, useCallback } from "react";
import { featureApi, type ThreadPatch } from "../services/featureApi";
import type {
  CodeReviewSession,
  ReviewThread,
  ReviewMessage,
} from "../types/sessions";
import { useRealtimeSync } from "./useRealtimeSync";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseCodeSessionReturn {
  session: CodeReviewSession | null;
  loading: boolean;
  error: string | null;
  saveSession: (session: CodeReviewSession) => Promise<void>;
  addThread: (thread: ReviewThread) => Promise<void>;
  patchThread: (
    threadId: string,
    patch: { status?: string; messages?: ReviewMessage[] },
  ) => Promise<void>;
  setVerdict: (verdict: "approved" | "changes_requested") => Promise<void>;
  deleteSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCodeSession(
  featureId: string | undefined,
): UseCodeSessionReturn {
  const [session, setSession] = useState<CodeReviewSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Echo suppression — skip the next realtime update that echoes our own save.
  const skipNextUpdate = useRef(false);

  // -------------------------------------------------------------------------
  // Load session on mount / featureId change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!featureId) {
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const { session: loaded } = await featureApi.getCodeSession(featureId);
        if (!cancelled) {
          setSession(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load code session",
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  // -------------------------------------------------------------------------
  // Realtime sync via HMR WebSocket
  // -------------------------------------------------------------------------

  useRealtimeSync("-code.json", (data) => {
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }
    // Only apply if the update belongs to our feature
    const incoming = data.session as CodeReviewSession | null;
    if (incoming && incoming.featureId === featureId) {
      setSession(incoming);
    }
  });

  // -------------------------------------------------------------------------
  // Save helper — marks echo suppression, persists full session
  // -------------------------------------------------------------------------

  const persistSession = useCallback(
    async (updated: CodeReviewSession) => {
      if (!featureId) return;
      skipNextUpdate.current = true;
      setSession(updated);
      try {
        await featureApi.saveCodeSession(featureId, updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save code session",
        );
        // Reset suppression so we don't miss real external updates
        skipNextUpdate.current = false;
      }
    },
    [featureId],
  );

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------

  const saveSession = useCallback(
    async (updated: CodeReviewSession) => {
      await persistSession(updated);
    },
    [persistSession],
  );

  const addThread = useCallback(
    async (thread: ReviewThread) => {
      if (!session || !featureId) return;
      const now = new Date().toISOString();
      const updated: CodeReviewSession = {
        ...session,
        threads: [...session.threads, thread],
        metadata: { ...session.metadata, updatedAt: now },
      };
      await persistSession(updated);
    },
    [session, featureId, persistSession],
  );

  const patchThread = useCallback(
    async (
      threadId: string,
      patch: { status?: string; messages?: ReviewMessage[] },
    ) => {
      if (!featureId) return;

      // Build the typed patch for the API
      const apiPatch: ThreadPatch = {};
      if (patch.status) {
        apiPatch.status = patch.status as ThreadPatch["status"];
      }
      if (patch.messages) {
        apiPatch.messages = patch.messages;
      }

      skipNextUpdate.current = true;
      try {
        const { thread: patched } = await featureApi.patchCodeThread(
          featureId,
          threadId,
          apiPatch,
        );

        // Optimistically update local state with the server response
        setSession((prev) => {
          if (!prev) return prev;
          const now = new Date().toISOString();
          return {
            ...prev,
            threads: prev.threads.map((t) => (t.id === threadId ? patched : t)),
            metadata: { ...prev.metadata, updatedAt: now },
          };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to patch thread");
        skipNextUpdate.current = false;
      }
    },
    [featureId],
  );

  const setVerdict = useCallback(
    async (verdict: "approved" | "changes_requested") => {
      if (!session || !featureId) return;
      const now = new Date().toISOString();
      const updated: CodeReviewSession = {
        ...session,
        verdict,
        metadata: { ...session.metadata, updatedAt: now },
      };
      await persistSession(updated);
    },
    [session, featureId, persistSession],
  );

  const deleteSession = useCallback(async () => {
    if (!featureId) return;
    skipNextUpdate.current = true;
    try {
      await featureApi.deleteCodeSession(featureId);
      setSession(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete code session",
      );
      skipNextUpdate.current = false;
    }
  }, [featureId]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    session,
    loading,
    error,
    saveSession,
    addThread,
    patchThread,
    setVerdict,
    deleteSession,
  };
}
