import type {
  SpecReviewSession,
  CodeReviewSession,
  ReviewThread,
  ReviewMessage,
  TaskProgress,
} from "../types/sessions";
import {
  SOURCE_TYPE,
  type SourceType,
  type FeatureStatus,
} from "../types/constants";

// Re-export so callers that imported from here continue to work.
export { SOURCE_TYPE, type SourceType };

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export type WorktreeListItem = {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
};

export type FeatureInfo = {
  id: string;
  worktreePath: string;
  branch: string;
  status: FeatureStatus;
  hasSpec: boolean;
  hasTasks: boolean;
  taskProgress: { done: number; total: number };
  openThreads: number;
  lastActivity: string | null;
  filesChanged: number;
  sourceType: SourceType;
};

export type ThreadPatch = {
  status?: "open" | "resolved" | "approved";
  messages?: ReviewMessage[];
};

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

const BASE = "/api";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const featureApi = {
  // Worktrees
  getWorktrees(): Promise<{ worktrees: WorktreeListItem[]; error?: string }> {
    return apiFetch<{ worktrees: WorktreeListItem[]; error?: string }>(
      `${BASE}/worktrees`,
    );
  },

  // Features
  getFeatures(): Promise<{ features: FeatureInfo[] }> {
    return apiFetch<{ features: FeatureInfo[] }>(`${BASE}/features`);
  },

  // Spec
  getSpec(featureId: string): Promise<{ content: string; path: string }> {
    return apiFetch<{ content: string; path: string }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec`,
    );
  },

  saveSpec(featureId: string, content: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );
  },

  getSpecSession(
    featureId: string,
  ): Promise<{ session: SpecReviewSession | null }> {
    return apiFetch<{ session: SpecReviewSession | null }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec-session`,
    );
  },

  saveSpecSession(
    featureId: string,
    session: SpecReviewSession,
  ): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      },
    );
  },

  deleteSpecSession(featureId: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec-session`,
      { method: "DELETE" },
    );
  },

  patchSpecThread(
    featureId: string,
    threadId: string,
    patch: ThreadPatch,
  ): Promise<{ ok: boolean; thread: ReviewThread }> {
    return apiFetch<{ ok: boolean; thread: ReviewThread }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/spec-session/threads/${encodeURIComponent(threadId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
  },

  // Code
  getCodeSession(
    featureId: string,
  ): Promise<{ session: CodeReviewSession | null }> {
    return apiFetch<{ session: CodeReviewSession | null }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/code-session`,
    );
  },

  saveCodeSession(
    featureId: string,
    session: CodeReviewSession,
  ): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/code-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      },
    );
  },

  deleteCodeSession(featureId: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/code-session`,
      { method: "DELETE" },
    );
  },

  patchCodeThread(
    featureId: string,
    threadId: string,
    patch: ThreadPatch,
  ): Promise<{ ok: boolean; thread: ReviewThread }> {
    return apiFetch<{ ok: boolean; thread: ReviewThread }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/code-session/threads/${encodeURIComponent(threadId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
  },

  // Tasks & Diagrams
  getTasks(featureId: string): Promise<{ tasks: TaskProgress }> {
    return apiFetch<{ tasks: TaskProgress }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/tasks`,
    );
  },

  getDiagrams(featureId: string): Promise<{ diagrams: string[] }> {
    return apiFetch<{ diagrams: string[] }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/diagrams`,
    );
  },

  getDiagram(
    featureId: string,
    name: string,
  ): Promise<{ content: string; name: string }> {
    return apiFetch<{ content: string; name: string }>(
      `${BASE}/features/${encodeURIComponent(featureId)}/diagrams/${encodeURIComponent(name)}`,
    );
  },

  // Resolver
  triggerResolve(
    featureId: string,
    sessionType: "code" | "spec",
  ): Promise<{
    ok: boolean;
    resolved?: number;
    clarifications?: number;
    fixes?: string[];
    error?: string;
  }> {
    return apiFetch(`${BASE}/resolver/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId, sessionType }),
    });
  },

  // Branches & Diff regeneration
  getBranches(worktreePath: string): Promise<{
    branches: string[];
    currentBranch: string;
    defaultTargetBranch: string;
  }> {
    const params = new URLSearchParams({ worktree: worktreePath });
    return apiFetch(`${BASE}/context?${params.toString()}`);
  },

  regenerateDiff(
    worktreePath: string,
    targetBranch: string,
    sourceBranch?: string,
  ): Promise<{
    worktreePath: string;
    sourceBranch: string;
    targetBranch: string;
    committedDiff: string;
    uncommittedDiff: string;
    allDiff: string;
  }> {
    const params = new URLSearchParams({
      worktree: worktreePath,
      target: targetBranch,
    });
    if (sourceBranch) params.set("source", sourceBranch);
    return apiFetch(`${BASE}/diff?${params.toString()}`);
  },
};
