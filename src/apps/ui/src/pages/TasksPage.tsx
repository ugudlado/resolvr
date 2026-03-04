import { useParams } from "react-router-dom";
import { useTaskProgress } from "../hooks/useTaskProgress";
import { TaskBoard } from "../components/tasks/TaskBoard";

export default function TasksPage() {
  const { featureId } = useParams<{ featureId: string }>();
  const { taskProgress, loading, error } = useTaskProgress(featureId);

  // ---------------------------------------------------------------------------
  // Guard: missing featureId
  // ---------------------------------------------------------------------------

  if (!featureId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)] text-slate-400">
        No feature selected
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          <span className="text-sm text-slate-400">Loading tasks...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="max-w-md rounded-lg border border-red-800 bg-red-900/20 px-6 py-4 text-sm text-red-300">
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
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)] text-slate-400">
        No tasks found
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-base)] px-6 py-4">
      <TaskBoard taskProgress={taskProgress} />
    </div>
  );
}
