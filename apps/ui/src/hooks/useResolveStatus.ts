import { useEffect, useRef, useState } from "react";

export type ResolveStatus =
  | { state: "idle" }
  | { state: "resolving"; featureId: string; threadCount: number }
  | {
      state: "completed";
      featureId: string;
      resolved: number;
      clarifications: number;
    }
  | { state: "failed"; featureId: string; error: string };

/**
 * Listens for review:resolve-started, review:resolve-completed, and
 * review:resolve-failed HMR events emitted by the Vite server when
 * the resolver daemon runs.
 *
 * Resets to idle 5 seconds after completion/failure so the status indicator fades out.
 */
export function useResolveStatus(): ResolveStatus {
  const [status, setStatus] = useState<ResolveStatus>({ state: "idle" });
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!import.meta.hot) return;

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
        5000,
      );
    };

    const onStarted = (data: { featureId: string; threadCount: number }) => {
      clearFadeTimer();
      setStatus({
        state: "resolving",
        featureId: data.featureId,
        threadCount: data.threadCount,
      });
    };

    const onCompleted = (data: {
      featureId: string;
      resolved: number;
      clarifications: number;
    }) => {
      setStatus({
        state: "completed",
        featureId: data.featureId,
        resolved: data.resolved,
        clarifications: data.clarifications,
      });
      startFadeTimer();
    };

    const onFailed = (data: { featureId: string; error: string }) => {
      setStatus({
        state: "failed",
        featureId: data.featureId,
        error: data.error,
      });
      startFadeTimer();
    };

    import.meta.hot.on("review:resolve-started", onStarted);
    import.meta.hot.on("review:resolve-completed", onCompleted);
    import.meta.hot.on("review:resolve-failed", onFailed);

    return () => {
      clearFadeTimer();
      import.meta.hot?.off?.("review:resolve-started", onStarted);
      import.meta.hot?.off?.("review:resolve-completed", onCompleted);
      import.meta.hot?.off?.("review:resolve-failed", onFailed);
    };
  }, []);

  return status;
}
