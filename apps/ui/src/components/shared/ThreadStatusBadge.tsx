import { THREAD_STATUS, type ThreadStatus } from "../../types/constants";
import {
  normalizeStatus,
  statusLabel,
  STATUS_COLORS,
} from "../../utils/threadStatus";

interface ThreadStatusBadgeProps {
  status: ThreadStatus;
  size?: "sm" | "md";
}

export function ThreadStatusBadge({
  status,
  size = "md",
}: ThreadStatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const colors = STATUS_COLORS[normalized] ?? STATUS_COLORS[THREAD_STATUS.Open];
  const label = statusLabel(normalized);

  const isSm = size === "sm";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{
        padding: isSm ? "1px 6px" : "2px 8px",
        fontSize: isSm ? "10px" : "11px",
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{
          width: isSm ? 5 : 6,
          height: isSm ? 5 : 6,
          backgroundColor: colors.dot,
        }}
      />
      {label}
    </span>
  );
}
