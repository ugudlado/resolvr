import { useState, useEffect, useRef, useCallback } from "react";
import type { ThreadPatch } from "../services/featureApi";
import type { ReviewThread, ReviewMessage } from "../types/sessions";
import { useRealtimeSync } from "./useRealtimeSync";

// ---------------------------------------------------------------------------
// Base constraint — both CodeReviewSession and SpecReviewSession satisfy this
// ---------------------------------------------------------------------------

interface SessionBase {
  featureId: string;
  verdict: "approved" | "changes_requested" | null;
  threads: ReviewThread[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Config — callers provide the API methods and realtime suffix
// ---------------------------------------------------------------------------

export interface FeatureSessionConfig<T extends SessionBase> {
  /** Realtime sync file suffix, e.g. "-code.json" or "-spec.json". */
  realtimeSuffix: string;
  /** Fetch the session from the server. */
  getSession: (featureId: string) => Promise<{ session: T | null }>;
  /** Persist the full session to the server. */
  saveSession: (featureId: string, session: T) => Promise<{ ok: boolean }>;
  /** Delete the session from the server. */
  deleteSession: (featureId: string) => Promise<{ ok: boolean }>;
  /** Patch a single thread on the server. */
  patchThread: (
    featureId: string,
    threadId: string,
    patch: ThreadPatch,
  ) => Promise<{ ok: boolean; thread: ReviewThread }>;
  /**
   * Optional factory to create a minimal session when setVerdict is called
   * but no session exists yet. If omitted, setVerdict is a no-op when session is null.
   */
  createInitialSession?: (featureId: string) => Promise<T>;
  /** Called after a session mutation is persisted to the server (e.g. thread patch, save, verdict). */
  onSessionChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseFeatureSessionReturn<T extends SessionBase> {
  session: T | null;
  loading: boolean;
  error: string | null;
  saveSession: (session: T) => Promise<void>;
  addThread: (thread: ReviewThread) => Promise<void>;
  patchThread: (
    threadId: string,
    patch: { status?: string; severity?: string; messages?: ReviewMessage[] },
  ) => Promise<void>;
  setVerdict: (verdict: "approved" | "changes_requested") => Promise<void>;
  deleteSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Generic hook
// ---------------------------------------------------------------------------

export function useFeatureSession<T extends SessionBase>(
  featureId: string | undefined,
  config: FeatureSessionConfig<T>,
): UseFeatureSessionReturn<T> {
  const [session, setSession] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipNextUpdate = useRef(false);
  const featureIdRef = useRef(featureId);
  useEffect(() => {
    featureIdRef.current = featureId;
  });

  // Keep config in a ref to avoid callback dependency churn
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
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
        const { session: loaded } =
          await configRef.current.getSession(featureId);
        if (!cancelled) {
          setSession(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load session",
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

  useRealtimeSync(config.realtimeSuffix, (data) => {
    if (!featureIdRef.current) return;
    if (!data.fileName.includes(featureIdRef.current)) return;

    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }

    const incoming = data.session as T | null;
    if (incoming && incoming.featureId === featureIdRef.current) {
      setSession(incoming);
    }
  });

  // --------------------------------------------------
  // Persist helper
  // --------------------------------------------------

  const persistSession = useCallback(async (updated: T): Promise<void> => {
    const fid = featureIdRef.current;
    if (!fid) return;

    skipNextUpdate.current = true;
    setSession(updated);

    try {
      await configRef.current.saveSession(fid, updated);
      configRef.current.onSessionChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session");
      skipNextUpdate.current = false;
    }
  }, []);

  // --------------------------------------------------
  // Public actions
  // --------------------------------------------------

  const saveSession = useCallback(
    async (updated: T): Promise<void> => {
      await persistSession(updated);
    },
    [persistSession],
  );

  // eslint-disable-next-line @typescript-eslint/require-await
  const addThread = useCallback(async (thread: ReviewThread): Promise<void> => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        threads: [...prev.threads, thread],
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      } as T;
      skipNextUpdate.current = true;
      const fid = featureIdRef.current;
      if (fid) {
        void configRef.current
          .saveSession(fid, updated)
          .then(() => {
            configRef.current.onSessionChanged?.();
          })
          .catch(() => {
            skipNextUpdate.current = false;
          });
      }
      return updated;
    });
  }, []);

  const patchThread = useCallback(
    async (
      threadId: string,
      patch: { status?: string; severity?: string; messages?: ReviewMessage[] },
    ): Promise<void> => {
      const fid = featureIdRef.current;
      if (!fid) return;

      skipNextUpdate.current = true;

      try {
        const apiPatch: ThreadPatch = {};
        if (patch.status) {
          apiPatch.status = patch.status as ThreadPatch["status"];
        }
        if (patch.severity) {
          apiPatch.severity = patch.severity;
        }
        if (patch.messages) {
          apiPatch.messages = patch.messages;
        }

        const { thread: updated } = await configRef.current.patchThread(
          fid,
          threadId,
          apiPatch,
        );

        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            threads: prev.threads.map((t) => (t.id === threadId ? updated : t)),
            metadata: {
              ...prev.metadata,
              updatedAt: new Date().toISOString(),
            },
          } as T;
        });

        configRef.current.onSessionChanged?.();
      } catch (err) {
        skipNextUpdate.current = false;
        setError(err instanceof Error ? err.message : "Failed to patch thread");
      }
    },
    [],
  );

  const setVerdict = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (verdict: "approved" | "changes_requested"): Promise<void> => {
      const fid = featureIdRef.current;
      if (!fid) return;

      setSession((prev) => {
        // If session exists, update it in place
        if (prev) {
          const updated = {
            ...prev,
            verdict,
            metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
          } as T;
          skipNextUpdate.current = true;
          void configRef.current
            .saveSession(fid, updated)
            .then(() => {
              configRef.current.onSessionChanged?.();
            })
            .catch(() => {
              skipNextUpdate.current = false;
            });
          return updated;
        }

        // No session yet — create one via factory if available
        if (configRef.current.createInitialSession) {
          skipNextUpdate.current = true;
          void configRef.current
            .createInitialSession(fid)
            .then((initial) => {
              const withVerdict = { ...initial, verdict } as T;
              return configRef.current
                .saveSession(fid, withVerdict)
                .then(() => {
                  setSession(withVerdict);
                  configRef.current.onSessionChanged?.();
                });
            })
            .catch(() => {
              skipNextUpdate.current = false;
            });
        }

        return prev;
      });
    },
    [],
  );

  const deleteSession = useCallback(async (): Promise<void> => {
    const fid = featureIdRef.current;
    if (!fid) return;

    skipNextUpdate.current = true;

    try {
      await configRef.current.deleteSession(fid);
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
