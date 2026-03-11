import type { FeatureStatus } from "../types/sessions";

export type { FeatureStatus } from "../types/sessions";

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  /** Which tab to auto-navigate to from dashboard */
  defaultTab: "code";
}

const STATUS_MAP: Record<FeatureStatus, StatusConfig> = {
  new: {
    label: "New",
    color: "text-slate-400",
    bgColor: "bg-slate-700/50",
    defaultTab: "code",
  },
  design: {
    label: "Design",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    defaultTab: "code",
  },
  design_review: {
    label: "Design Review",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
    defaultTab: "code",
  },
  code: {
    label: "Code",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    defaultTab: "code",
  },
  code_review: {
    label: "Code Review",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
    defaultTab: "code",
  },
  complete: {
    label: "Complete",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    defaultTab: "code",
  },
};

export function getStatusConfig(status: FeatureStatus): StatusConfig {
  return STATUS_MAP[status];
}
