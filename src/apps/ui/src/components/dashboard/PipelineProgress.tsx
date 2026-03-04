import type { FeatureStatus } from "../../types/sessions";

const STAGES: FeatureStatus[] = [
  "new",
  "design",
  "design_review",
  "code",
  "code_review",
  "complete",
];

const STAGE_LABELS: Record<FeatureStatus, string> = {
  new: "New",
  design: "Design",
  design_review: "Review",
  code: "Code",
  code_review: "Review",
  complete: "Done",
};

export interface PipelineProgressProps {
  status: FeatureStatus;
}

export default function PipelineProgress({ status }: PipelineProgressProps) {
  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const color = isPast || isCurrent ? "bg-blue-500" : "bg-slate-700";

        return (
          <div key={stage} className="flex min-w-0 flex-1 flex-col gap-1">
            <div className={`h-1.5 rounded-full ${color}`} />
            {isCurrent && (
              <span className="text-center text-[9px] font-medium text-blue-400">
                {STAGE_LABELS[stage]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
