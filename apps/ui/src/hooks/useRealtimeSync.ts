import { useEffect, useRef } from "react";
import { wsOn } from "./wsClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeCallback = (data: {
  fileName: string;
  session: unknown;
}) => void;

type Subscription = {
  suffix: string;
  callback: RealtimeCallback;
};

// ---------------------------------------------------------------------------
// Singleton manager — one WebSocket listener, many subscribers
// ---------------------------------------------------------------------------

const subscriptions = new Set<Subscription>();
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  wsOn("review:session-updated", (raw) => {
    const data = raw as { fileName: string; session: unknown };
    for (const sub of subscriptions) {
      if (data.fileName.endsWith(sub.suffix)) {
        try {
          sub.callback(data);
        } catch {
          // Never let a subscriber error tear down the listener.
        }
      }
    }
  });
}

/**
 * Subscribe to realtime session-file updates whose filename ends with
 * `suffix`.  Returns an unsubscribe function.
 */
function subscribe(suffix: string, cb: RealtimeCallback): () => void {
  ensureInitialized();
  const sub: Subscription = { suffix, callback: cb };
  subscriptions.add(sub);
  return () => {
    subscriptions.delete(sub);
  };
}

// Expose for tests / advanced usage.
export const realtimeSync = { subscribe } as const;

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Register a callback that fires whenever a session file whose name ends
 * with `suffix` is updated on disk (pushed via the Vite HMR WebSocket).
 *
 * The callback reference is kept in a ref so the subscriber never goes
 * stale — callers don't need to memoize the callback.
 *
 * ```ts
 * useRealtimeSync("-spec.json", (data) => {
 *   console.log("spec session changed", data.session);
 * });
 * ```
 */
export function useRealtimeSync(
  suffix: string,
  callback: RealtimeCallback,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe(suffix, (data) => {
      callbackRef.current(data);
    });
    return unsubscribe;
  }, [suffix]);
}
