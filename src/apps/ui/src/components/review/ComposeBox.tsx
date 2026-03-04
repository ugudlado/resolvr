export function ComposeBox({
  selection,
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  selection: { startLine: number; endLine: number; side: string };
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-[var(--accent-blue)]/60 mt-2 rounded-lg border bg-[var(--bg-surface)] shadow-lg">
      <div className="border-b border-[var(--border-default)] px-3 py-2 text-[11px] text-slate-500">
        Commenting on {selection.side} lines {selection.startLine}
        {selection.endLine !== selection.startLine
          ? `–${selection.endLine}`
          : ""}
      </div>
      <div className="flex gap-2 p-3">
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Leave a comment… (⌘↵ to submit, Esc to cancel)"
          autoFocus
          className="flex-1 resize-none rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-slate-300 placeholder-slate-700 outline-none focus:border-[var(--accent-blue)]"
        />
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onSubmit}
            className="border-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/30 rounded border px-3 py-1 text-xs font-medium text-blue-300"
          >
            Comment
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-slate-400 hover:bg-[var(--border-default)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
