import { featureApi } from "../services/featureApi";
import type { SpecReviewSession } from "../types/sessions";
import {
  useFeatureSession,
  type UseFeatureSessionReturn,
} from "./useFeatureSession";

export type UseSpecSessionReturn = UseFeatureSessionReturn<SpecReviewSession>;

async function createInitialSpecSession(
  featureId: string,
): Promise<SpecReviewSession> {
  const { path: specPath } = await featureApi.getSpec(featureId);
  const now = new Date().toISOString();
  return {
    featureId,
    worktreePath: "",
    specPath,
    verdict: null,
    threads: [],
    taskProgress: {
      featureId,
      developmentMode: "Non-TDD",
      total: 0,
      completed: 0,
      inProgress: 0,
      phases: [],
      overallProgress: 0,
    },
    metadata: { createdAt: now, updatedAt: now },
  };
}

export function useSpecSession(
  featureId: string | undefined,
  options?: { onSessionChanged?: () => void },
): UseSpecSessionReturn {
  return useFeatureSession<SpecReviewSession>(featureId, {
    realtimeSuffix: "-spec.json",
    getSession: (id) => featureApi.getSpecSession(id),
    saveSession: (id, session) => featureApi.saveSpecSession(id, session),
    deleteSession: (id) => featureApi.deleteSpecSession(id),
    patchThread: (id, threadId, patch) =>
      featureApi.patchSpecThread(id, threadId, patch),
    createInitialSession: createInitialSpecSession,
    onSessionChanged: options?.onSessionChanged,
  });
}
