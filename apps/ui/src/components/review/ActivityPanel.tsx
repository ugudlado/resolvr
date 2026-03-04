// apps/ui/src/components/review/ActivityPanel.tsx
export type ActivityEntry = {
  threadId: string;
  filePath: string;
  line: number;
  type: "replied" | "fixed" | "clarification";
  preview: string;
  timestamp: string;
};

export function ActivityPanel({
  running,
  entries,
  onEntryClick,
  onClear,
}: {
  running: boolean;
  entries: ActivityEntry[];
  onEntryClick: (threadId: string, filePath: string, line: number) => void;
  onClear: () => void;
}) {
  if (!running && entries.length === 0) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border-default)] bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-3 py-2">
        {running ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
            <span className="text-xs font-medium text-indigo-300">
              Claude is working…
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-emerald-400">✓</span>
            <span className="text-xs font-medium text-slate-300">
              Claude finished
            </span>
          </>
        )}
        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear activity entries"
            className="ml-auto text-[10px] text-slate-600 hover:text-slate-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-1 overflow-y-auto p-2">
        {entries.length === 0 && running && (
          <p className="px-1 pt-2 text-xs text-slate-600">
            Waiting for Claude…
          </p>
        )}
        {entries.map((entry, i) => (
          <button
            key={`${entry.threadId}-${entry.timestamp}-${i}`}
            type="button"
            onClick={() =>
              onEntryClick(entry.threadId, entry.filePath, entry.line)
            }
            className="group flex flex-col gap-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2 text-left hover:border-indigo-600/40 hover:bg-[var(--bg-surface)]"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                  entry.type === "replied"
                    ? "bg-indigo-900/40 text-indigo-300"
                    : entry.type === "fixed"
                      ? "bg-emerald-900/40 text-emerald-300"
                      : "bg-amber-900/40 text-amber-300"
                }`}
              >
                {entry.type === "replied"
                  ? "replied"
                  : entry.type === "fixed"
                    ? "fixed"
                    : "clarification"}
              </span>
              <span className="truncate font-mono text-[10px] text-slate-500 group-hover:text-slate-400">
                {entry.filePath}:{entry.line}
              </span>
            </div>
            <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">
              {entry.preview}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
