import { useParams } from "react-router-dom";
import { useTaskProgress } from "../hooks/useTaskProgress";
import { TaskTimeline } from "../components/tasks/TaskTimeline";

export default function TasksPage() {
  const { featureId } = useParams<{ featureId: string }>();
  const { taskProgress, loading, error } = useTaskProgress(featureId);

  // ---------------------------------------------------------------------------
  // Guard: missing featureId
  // ---------------------------------------------------------------------------

  if (!featureId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--canvas)] text-[var(--ink-muted)]">
        No feature selected
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--canvas)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-blue)]" />
          <span className="text-sm text-[var(--ink-muted)]">
            Loading tasks...
          </span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--canvas)]">
        <div className="bg-[var(--accent-rose-dim)]/20 max-w-md rounded-lg border border-[var(--accent-rose-dim)] px-6 py-4 text-sm text-[var(--accent-rose)]">
          {error}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No task data
  // ---------------------------------------------------------------------------

  if (!taskProgress) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--canvas)] text-[var(--ink-muted)]">
        No tasks found
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full overflow-y-auto bg-[var(--canvas)]">
      <TaskTimeline taskProgress={taskProgress} />
    </div>
  );
}
