import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const items = shortcuts ?? defaultShortcuts;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-full max-w-sm overflow-hidden border-[var(--border-default)] bg-[var(--bg-surface)] p-0"
        style={{
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Header */}
        <DialogHeader className="border-b border-[var(--border-muted)] px-5 py-4">
          <DialogTitle className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of keyboard shortcuts available on this page
          </DialogDescription>
        </DialogHeader>

        {/* Shortcut rows */}
        <div className="px-5 py-3">
          <div className="space-y-1">
            {items.map((s) => (
              <div
                key={`${s.key}-${s.description}`}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-[13px] text-[var(--text-secondary)]">
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
        <div className="border-t border-[var(--border-muted)] px-5 py-3">
          <p className="text-[11px] text-[var(--text-muted)]">
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
      </DialogContent>
    </Dialog>
  );
}
