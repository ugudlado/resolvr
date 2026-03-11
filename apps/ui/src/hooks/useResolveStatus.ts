import { useEffect, useRef, useState } from "react";
import { wsOn } from "./wsClient";

export type ResolveOutcome = "resolved" | "clarification" | "error";

export type ThreadLogEntry = {
  threadId: string;
  filePath: string;
  line: number;
  outcome: ResolveOutcome;
  timestamp: string;
};

export type ThreadInfo = {
  id: string;
  filePath: string;
  line: number;
};

export type ResolveStatus =
  | { state: "idle" }
  | {
      state: "resolving";
      featureId: string;
      threadCount: number;
      threads: ThreadInfo[];
      resolved: number;
      log: ThreadLogEntry[];
    }
  | {
      state: "completed";
      featureId: string;
      resolved: number;
      clarifications: number;
      log: ThreadLogEntry[];
    }
  | { state: "failed"; featureId: string; error: string };

/**
 * Listens for review:resolve-* HMR events and tracks per-thread progress.
 *
 * Events:
 * - resolve-started: begins tracking with thread list
 * - resolve-thread-done: logs each thread completion
 * - resolve-completed: final summary
 * - resolve-failed: error state
 *
 * Resets to idle 8 seconds after completion/failure.
 */
export function useResolveStatus(): ResolveStatus {
  const [status, setStatus] = useState<ResolveStatus>({ state: "idle" });
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const clearFadeTimer = () => {
      if (fadeTimerRef.current !== undefined) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = undefined;
      }
    };

    const startFadeTimer = () => {
      clearFadeTimer();
      fadeTimerRef.current = setTimeout(
        () => setStatus({ state: "idle" }),
        8000,
      );
    };

    const unsubStarted = wsOn("review:resolve-started", (raw) => {
      const data = raw as {
        featureId: string;
        threadCount: number;
        threads?: ThreadInfo[];
      };
      clearFadeTimer();
      setStatus({
        state: "resolving",
        featureId: data.featureId,
        threadCount: data.threadCount,
        threads: data.threads ?? [],
        resolved: 0,
        log: [],
      });
    });

    const unsubThreadDone = wsOn("review:resolve-thread-done", (raw) => {
      const data = raw as {
        featureId: string;
        threadId: string;
        filePath: string;
        line: number;
        outcome: ResolveOutcome;
      };
      setStatus((prev) => {
        if (prev.state !== "resolving") return prev;
        if (prev.featureId !== data.featureId) return prev;
        const entry: ThreadLogEntry = {
          threadId: data.threadId,
          filePath: data.filePath,
          line: data.line,
          outcome: data.outcome,
          timestamp: new Date().toISOString(),
        };
        return {
          ...prev,
          resolved: prev.resolved + 1,
          log: [...prev.log, entry],
        };
      });
    });

    const unsubCompleted = wsOn("review:resolve-completed", (raw) => {
      const data = raw as {
        featureId: string;
        resolved: number;
        clarifications: number;
      };
      setStatus((prev) => {
        const log = prev.state === "resolving" ? prev.log : [];
        return {
          state: "completed",
          featureId: data.featureId,
          resolved: data.resolved,
          clarifications: data.clarifications,
          log,
        };
      });
      startFadeTimer();
    });

    const unsubFailed = wsOn("review:resolve-failed", (raw) => {
      const data = raw as { featureId: string; error: string };
      clearFadeTimer();
      setStatus({
        state: "failed",
        featureId: data.featureId,
        error: data.error,
      });
      // No fade timer — failure persists until user retries or new resolve starts
    });

    return () => {
      clearFadeTimer();
      unsubStarted();
      unsubThreadDone();
      unsubCompleted();
      unsubFailed();
    };
  }, []);

  return status;
}
