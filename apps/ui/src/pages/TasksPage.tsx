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
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)] text-[var(--text-secondary)]">
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
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-blue)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            Loading tasks...
          </span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state or No task data
  // ---------------------------------------------------------------------------

  if (error || !taskProgress) {
    const isNotFound = error?.includes("404") || error?.includes("not found");
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          {/* Icon */}
          <svg
            className="h-12 w-12 text-[var(--text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
            />
          </svg>

          {/* Title and description */}
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {isNotFound ? "No tasks yet" : "Could not load tasks"}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {isNotFound
                ? "Create a tasks.md file in your feature spec to track development phases here."
                : error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-base)]">
      <TaskTimeline taskProgress={taskProgress} />
    </div>
  );
}
