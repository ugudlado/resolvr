import { useMemo } from "react";

interface HasStatus {
  status: "open" | "resolved" | "approved";
}

/** Split threads into open and resolved/approved buckets with stable references. */
export function useThreadPartition<T extends HasStatus>(threads: T[]) {
  const openThreads = useMemo(
    () => threads.filter((t) => t.status === "open"),
    [threads],
  );

  const resolvedThreads = useMemo(
    () =>
      threads.filter((t) => t.status === "resolved" || t.status === "approved"),
    [threads],
  );

  return { openThreads, resolvedThreads };
}
