// apps/ui/src/components/review/ReviewToolbar.tsx
export function ReviewToolbar({
  reviewVerdict,
  onApprove,
  onRequestChanges,
}: {
  reviewVerdict: "approved" | "changes_requested" | null;
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2">
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={onApprove}
          className={`rounded border px-2.5 py-1 text-xs transition ${
            reviewVerdict === "approved"
              ? "border-emerald-600/70 bg-emerald-700/40 text-emerald-200"
              : "border-emerald-600/50 bg-emerald-700/20 text-emerald-300 hover:bg-emerald-700/30"
          }`}
        >
          {reviewVerdict === "approved" ? "✓ Approved" : "Approve"}
        </button>
        <button
          type="button"
          onClick={onRequestChanges}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition ${
            reviewVerdict === "changes_requested"
              ? "border-rose-600/70 bg-rose-700/40 text-rose-200"
              : "border-rose-700/50 bg-rose-700/20 text-rose-300 hover:bg-rose-700/30"
          }`}
        >
          {reviewVerdict === "changes_requested"
            ? "✗ Changes Requested"
            : "Request Changes"}
        </button>
      </div>
    </div>
  );
}
