import type { AuthorType } from "../types/sessions";
import { withRepo } from "../hooks/useRepoContext";

export type ReviewMessage = {
  id: string;
  authorType: AuthorType;
  author: string;
  text: string;
  createdAt: string;
};

export type ReviewThread = {
  id: string;
  filePath: string;
  line: number;
  lineEnd?: number;
  side: "old" | "new";
  anchorContent?: string; // text of the anchor line at comment time
  status: "open" | "resolved" | "approved";
  severity?: string;
  messages: ReviewMessage[];
  lastUpdatedAt: string;
  /** Analytics labels for resolved threads (e.g., severity, model name) */
  labels?: Record<string, string>;
};

export type RepoWorktree = {
  path: string;
  branch: string;
  isCurrent: boolean;
};

export type RepoContext = {
  worktrees: RepoWorktree[];
  currentWorktree: string;
  branches: string[];
  currentBranch: string;
  defaultTargetBranch: string;
};

export type DiffBundle = {
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  committedDiff: string;
  uncommittedDiff: string;
  allDiff: string;
};

export type CommitInfo = {
  hash: string;
  shortHash: string;
  subject: string;
  authorDate: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // no-op: keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const localReviewApi = {
  async getContext(
    worktreePath?: string,
    repo?: string | null,
    workspace?: string | null,
  ): Promise<RepoContext> {
    const params = new URLSearchParams();
    if (worktreePath) {
      params.set("worktree", worktreePath);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const url = withRepo(
      `/api/context${suffix}`,
      repo ?? null,
      workspace ?? null,
    );
    const response = await fetch(url);
    return await parseJson<RepoContext>(response);
  },

  async getDiffBundle(params: {
    worktreePath?: string;
    sourceBranch?: string;
    targetBranch?: string;
    repo?: string | null;
    workspace?: string | null;
  }): Promise<DiffBundle> {
    const query = new URLSearchParams();
    if (params.worktreePath) {
      query.set("worktree", params.worktreePath);
    }
    if (params.targetBranch) {
      query.set("target", params.targetBranch);
    }
    if (params.sourceBranch) {
      query.set("source", params.sourceBranch);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const url = withRepo(
      `/api/diff${suffix}`,
      params.repo ?? null,
      params.workspace ?? null,
    );
    const response = await fetch(url);
    return await parseJson<DiffBundle>(response);
  },

  async getCommits(params: {
    worktreePath?: string;
    sourceBranch?: string;
    targetBranch?: string;
    repo?: string | null;
    workspace?: string | null;
  }): Promise<CommitInfo[]> {
    const query = new URLSearchParams();
    if (params.worktreePath) {
      query.set("worktree", params.worktreePath);
    }
    if (params.targetBranch) {
      query.set("target", params.targetBranch);
    }
    if (params.sourceBranch) {
      query.set("source", params.sourceBranch);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const url = withRepo(
      `/api/commits${suffix}`,
      params.repo ?? null,
      params.workspace ?? null,
    );
    const response = await fetch(url);
    const data = await parseJson<{ commits: CommitInfo[] }>(response);
    return data.commits;
  },

  async getCommitDiff(params: {
    worktreePath?: string;
    commit: string;
    repo?: string | null;
    workspace?: string | null;
  }): Promise<string> {
    const query = new URLSearchParams();
    if (params.worktreePath) {
      query.set("worktree", params.worktreePath);
    }
    query.set("commit", params.commit);
    const url = withRepo(
      `/api/commit-diff?${query.toString()}`,
      params.repo ?? null,
      params.workspace ?? null,
    );
    const response = await fetch(url);
    const data = await parseJson<{ diff: string }>(response);
    return data.diff;
  },

  async getFileContent(params: {
    worktreePath?: string;
    filePath: string;
    repo?: string | null;
    workspace?: string | null;
  }): Promise<string> {
    const query = new URLSearchParams({ path: params.filePath });
    if (params.worktreePath) query.set("worktree", params.worktreePath);
    const url = withRepo(
      `/api/file?${query.toString()}`,
      params.repo ?? null,
      params.workspace ?? null,
    );
    const response = await fetch(url);
    const data = await parseJson<{ content: string }>(response);
    return data.content;
  },
};
