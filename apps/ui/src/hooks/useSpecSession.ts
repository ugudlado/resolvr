import { useState, useEffect, useRef, useCallback } from "react";
import { featureApi, type ThreadPatch } from "../services/featureApi";
import type {
  SpecReviewSession,
  ReviewThread,
  ReviewMessage,
} from "../types/sessions";
import { useRealtimeSync } from "./useRealtimeSync";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseSpecSessionReturn {
  session: SpecReviewSession | null;
  loading: boolean;
  error: string | null;
  saveSession: (session: SpecReviewSession) => Promise<void>;
  addThread: (thread: ReviewThread) => Promise<void>;
  patchThread: (
    threadId: string,
    patch: { status?: string; messages?: ReviewMessage[] },
  ) => Promise<void>;
  setVerdict: (verdict: "approved" | "changes_requested") => Promise<void>;
  deleteSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useSpecSession(
  featureId: string | undefined,
): UseSpecSessionReturn {
  const [session, setSession] = useState<SpecReviewSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Echo suppression: set before saves, cleared by the realtime listener.
  const skipNextUpdate = useRef(false);

  // Track featureId in a ref so callbacks always see the latest value
  // without needing it in their dependency arrays.
  const featureIdRef = useRef(featureId);
  useEffect(() => {
    featureIdRef.current = featureId;
  });

  // --------------------------------------------------
  // Load session on mount / featureId change
  // --------------------------------------------------

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
        const { session: loaded } = await featureApi.getSpecSession(featureId);
        if (!cancelled) {
          setSession(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load spec session",
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  // --------------------------------------------------
  // Realtime sync — listen for external file changes
  // --------------------------------------------------

  useRealtimeSync("-spec.json", (data) => {
    // Only handle events for the current feature
    if (!featureIdRef.current) return;
    if (!data.fileName.includes(featureIdRef.current)) return;

    // Skip echoes from our own saves
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }

    // Reload from API to get the canonical state
    void (async () => {
      try {
        const { session: reloaded } = await featureApi.getSpecSession(
          featureIdRef.current!,
        );
        setSession(reloaded);
      } catch {
        // Silent — don't interrupt the user for background sync failures
      }
    })();
  });

  // --------------------------------------------------
  // Save helpers
  // --------------------------------------------------

  const saveSession = useCallback(
    async (updated: SpecReviewSession): Promise<void> => {
      const fid = featureIdRef.current;
      if (!fid) return;

      skipNextUpdate.current = true;
      setSession(updated);

      try {
        await featureApi.saveSpecSession(fid, updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save spec session",
        );
        // Reset echo suppression so we still pick up external changes
        skipNextUpdate.current = false;
      }
    },
    [],
  );

  const addThread = useCallback(async (thread: ReviewThread): Promise<void> => {
    const fid = featureIdRef.current;
    if (!fid) return;

    setSession((prev) => {
      if (!prev) return prev;
      const updated: SpecReviewSession = {
        ...prev,
        threads: [...prev.threads, thread],
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      };
      // Fire off the save (we capture `updated` in the closure)
      skipNextUpdate.current = true;
      void featureApi.saveSpecSession(fid, updated).catch(() => {
        skipNextUpdate.current = false;
      });
      return updated;
    });
  }, []);

  const patchThread = useCallback(
    async (
      threadId: string,
      patch: { status?: string; messages?: ReviewMessage[] },
    ): Promise<void> => {
      const fid = featureIdRef.current;
      if (!fid) return;

      skipNextUpdate.current = true;

      try {
        const apiPatch: ThreadPatch = {};
        if (patch.status) {
          apiPatch.status = patch.status as ThreadPatch["status"];
        }
        if (patch.messages) {
          apiPatch.messages = patch.messages;
        }

        const { thread: updated } = await featureApi.patchSpecThread(
          fid,
          threadId,
          apiPatch,
        );

        // Update local state with the server-returned thread
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            threads: prev.threads.map((t) => (t.id === threadId ? updated : t)),
            metadata: {
              ...prev.metadata,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      } catch (err) {
        skipNextUpdate.current = false;
        setError(err instanceof Error ? err.message : "Failed to patch thread");
      }
    },
    [],
  );

  const setVerdict = useCallback(
    async (verdict: "approved" | "changes_requested"): Promise<void> => {
      const fid = featureIdRef.current;
      if (!fid) return;

      setSession((prev) => {
        if (!prev) return prev;
        const updated: SpecReviewSession = {
          ...prev,
          verdict,
          metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
        };
        skipNextUpdate.current = true;
        void featureApi.saveSpecSession(fid, updated).catch(() => {
          skipNextUpdate.current = false;
        });
        return updated;
      });
    },
    [],
  );

  const deleteSession = useCallback(async (): Promise<void> => {
    const fid = featureIdRef.current;
    if (!fid) return;

    skipNextUpdate.current = true;

    try {
      await featureApi.deleteSpecSession(fid);
      setSession(null);
    } catch (err) {
      skipNextUpdate.current = false;
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  }, []);

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
