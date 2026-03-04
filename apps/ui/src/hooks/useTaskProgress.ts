import { useState, useEffect, useCallback } from "react";
import type { TaskProgress } from "../types/sessions";
import { featureApi } from "../services/featureApi";

export interface UseTaskProgressReturn {
  taskProgress: TaskProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTaskProgress(
  featureId: string | undefined,
): UseTaskProgressReturn {
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!featureId) {
      setTaskProgress(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tasks } = await featureApi.getTasks(featureId);
      setTaskProgress(tasks);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch tasks";
      setError(message);
      setTaskProgress(null);
    } finally {
      setLoading(false);
    }
  }, [featureId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  return { taskProgress, loading, error, refresh: fetchTasks };
}
