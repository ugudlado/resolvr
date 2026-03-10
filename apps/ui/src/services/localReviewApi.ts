import type { AuthorType } from "../types/sessions";

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

export type InlineComment = {
  id: string;
  filePath: string;
  line: number;
  side: "old" | "new";
  text: string;
  createdAt: string;
};

export type ReviewSession = {
  name: string;
  notes: string;
  diff: string;
  diffMode?: DiffMode;
  committedDiff?: string;
  uncommittedDiff?: string;
  allDiff?: string;
  targetBranch?: string;
  sourceBranch?: string;
  worktreePath?: string;
  threads?: ReviewThread[];
  comments?: InlineComment[];
  createdAt?: string;
  reviewVerdict?: "approved" | "changes_requested" | null;
  aiReviewStatus?: "running" | "done" | null;
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

export type DiffMode = "all" | "committed" | "uncommitted";

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
  async getContext(worktreePath?: string): Promise<RepoContext> {
    const params = new URLSearchParams();
    if (worktreePath) {
      params.set("worktree", worktreePath);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`/api/context${suffix}`);
    return await parseJson<RepoContext>(response);
  },

  async getDiffBundle(params: {
    worktreePath?: string;
    sourceBranch?: string;
    targetBranch?: string;
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
    const response = await fetch(`/api/diff${suffix}`);
    return await parseJson<DiffBundle>(response);
  },

  async getCommits(params: {
    worktreePath?: string;
    sourceBranch?: string;
    targetBranch?: string;
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
    const response = await fetch(`/api/commits${suffix}`);
    const data = await parseJson<{ commits: CommitInfo[] }>(response);
    return data.commits;
  },

  async getCommitDiff(params: {
    worktreePath?: string;
    commit: string;
  }): Promise<string> {
    const query = new URLSearchParams();
    if (params.worktreePath) {
      query.set("worktree", params.worktreePath);
    }
    query.set("commit", params.commit);
    const response = await fetch(`/api/commit-diff?${query.toString()}`);
    const data = await parseJson<{ diff: string }>(response);
    return data.diff;
  },

  async getFileContent(params: {
    worktreePath?: string;
    filePath: string;
  }): Promise<string> {
    const query = new URLSearchParams({ path: params.filePath });
    if (params.worktreePath) query.set("worktree", params.worktreePath);
    const response = await fetch(`/api/file?${query.toString()}`);
    const data = await parseJson<{ content: string }>(response);
    return data.content;
  },
};
