interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: "\u2318K", description: "Command palette" },
  { key: "j / k", description: "Next / previous thread" },
  { key: "r", description: "Reply to thread" },
  { key: "e", description: "Resolve thread" },
  { key: "[ / ]", description: "Previous / next commit" },
  { key: "?", description: "Show this help" },
  { key: "Esc", description: "Close dialog" },
];

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
          Keyboard Shortcuts
        </h2>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                {s.description}
              </span>
              <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--text-tertiary)]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-[var(--text-muted)]">
          Press Esc or ? to close
        </p>
      </div>
    </div>
  );
}
