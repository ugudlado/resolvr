/**
 * SectionLabel — reusable section header with badge count
 * Used in thread navigation and thread panel views
 */

import { memo } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SectionLabelProps {
  label: string;
  count: number;
  variant: "open" | "resolved" | "wontfix" | "outdated";
  sticky?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}

const BADGE_COLORS: Record<string, string> = {
  open: "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)] hover:bg-[var(--accent-amber-dim)]",
  resolved:
    "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-dim)]",
  wontfix:
    "bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]",
  outdated:
    "bg-[var(--accent-purple-dim)] text-[var(--accent-purple)] hover:bg-[var(--accent-purple-dim)]",
};

export const SectionLabel = memo(function SectionLabel({
  label,
  count,
  variant,
  sticky = true,
  onClick,
  collapsed,
}: SectionLabelProps) {
  const badgeColors = BADGE_COLORS[variant] ?? BADGE_COLORS.open;
  const stickyClass = sticky ? "sticky top-0 z-10" : "";
  const clickable = onClick !== undefined;

  return (
    <div
      className={`flex items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 ${stickyClass} ${clickable ? "cursor-pointer select-none hover:bg-[var(--bg-elevated)]" : ""}`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      aria-expanded={clickable ? !collapsed : undefined}
    >
      {clickable && (
        <ChevronRightIcon
          size={12}
          className="shrink-0 text-[var(--text-muted)] transition-transform duration-150"
          style={{
            transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
          }}
        />
      )}
      <span className="text-xs font-medium text-[var(--text-primary)]">
        {label}
      </span>
      {count > 0 && (
        <Badge
          variant="secondary"
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeColors}`}
        >
          {count}
        </Badge>
      )}
    </div>
  );
});
