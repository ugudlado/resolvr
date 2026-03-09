import { kbdStyle } from "./KeyboardHint";

interface Shortcut {
  key: string;
  description: string;
}

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
  /** Page-specific shortcuts to display. Falls back to spec-review defaults if omitted. */
  shortcuts?: Shortcut[];
}

const defaultShortcuts: Shortcut[] = [
  { key: "\u2318K", description: "Command palette" },
  { key: "j / k", description: "Next / previous thread" },
  { key: "r", description: "Reply to thread" },
  { key: "r", description: "Resolve thread" },
  { key: "[ / ]", description: "Previous / next commit" },
  { key: "?", description: "Show this help" },
  { key: "Esc", description: "Close dialog" },
];

export function ShortcutHelp({ open, onClose, shortcuts }: ShortcutHelpProps) {
  if (!open) return null;

  const items = shortcuts ?? defaultShortcuts;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl shadow-xl"
        style={{
          background: "var(--canvas-raised)",
          border: "1px solid var(--border)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--ink-faint)" }}
          >
            Keyboard Shortcuts
          </h2>
          <kbd
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={kbdStyle}
          >
            ?
          </kbd>
        </div>

        {/* Shortcut rows */}
        <div className="px-5 py-3">
          <div className="space-y-1">
            {items.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1.5"
              >
                <span
                  className="text-[13px]"
                  style={{ color: "var(--ink-muted)" }}
                >
                  {s.description}
                </span>
                <kbd
                  className="ml-4 shrink-0 rounded px-2 py-0.5 font-mono text-[11px]"
                  style={kbdStyle}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[11px]" style={{ color: "var(--ink-ghost)" }}>
            Press{" "}
            <kbd
              className="rounded px-1 py-px font-mono text-[10px]"
              style={kbdStyle}
            >
              Esc
            </kbd>{" "}
            or{" "}
            <kbd
              className="rounded px-1 py-px font-mono text-[10px]"
              style={kbdStyle}
            >
              ?
            </kbd>{" "}
            to dismiss
          </p>
        </div>
      </div>
    </div>
  );
}
