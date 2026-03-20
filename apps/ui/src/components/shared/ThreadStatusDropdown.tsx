import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { THREAD_STATUS, type ThreadStatus } from "../../types/constants";
import {
  normalizeStatus,
  statusLabel,
  STATUS_COLORS,
} from "../../utils/threadStatus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ThreadStatusDropdownProps {
  currentStatus: ThreadStatus;
  onStatusChange: (status: ThreadStatus) => void;
}

const TRANSITIONS: Record<string, ThreadStatus[]> = {
  [THREAD_STATUS.Open]: [
    THREAD_STATUS.Resolved,
    THREAD_STATUS.WontFix,
    THREAD_STATUS.Outdated,
  ],
  [THREAD_STATUS.Resolved]: [THREAD_STATUS.Open],
  [THREAD_STATUS.WontFix]: [THREAD_STATUS.Open, THREAD_STATUS.Resolved],
  [THREAD_STATUS.Outdated]: [THREAD_STATUS.Open, THREAD_STATUS.Resolved],
};

export function ThreadStatusDropdown({
  currentStatus,
  onStatusChange,
}: ThreadStatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeStatus(currentStatus);
  const transitions = TRANSITIONS[normalized] ?? [THREAD_STATUS.Open];
  const primaryAction = transitions[0];
  const isOpen = normalized === THREAD_STATUS.Open;

  const primaryLabel = isOpen ? "Resolve" : "Reopen";
  const primaryColor = isOpen ? "var(--accent-emerald)" : "var(--accent-amber)";

  const handlePrimary = () => {
    onStatusChange(primaryAction);
  };

  const handleSelect = (status: ThreadStatus) => {
    setOpen(false);
    onStatusChange(status);
  };

  // If only one transition (resolved→open), just show a simple button
  if (transitions.length === 1) {
    return (
      <button
        type="button"
        onClick={handlePrimary}
        className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--bg-overlay)]"
        style={{ color: primaryColor }}
      >
        {primaryLabel}
      </button>
    );
  }

  return (
    <div
      className="flex items-center rounded"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <button
        type="button"
        onClick={handlePrimary}
        className="rounded-l px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--bg-overlay)]"
        style={{ color: primaryColor }}
      >
        {primaryLabel}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-r px-1.5 py-1 transition-colors hover:bg-[var(--bg-overlay)]"
            style={{
              color: "var(--text-secondary)",
              borderLeft: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <ChevronDownIcon size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-40 rounded-lg border-[var(--border-default)] p-1 shadow-lg"
          align="end"
          sideOffset={4}
        >
          {transitions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleSelect(status)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-[var(--bg-overlay)]"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor:
                    STATUS_COLORS[status]?.dot ?? "var(--text-muted)",
                }}
              />
              {statusLabel(status)}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
