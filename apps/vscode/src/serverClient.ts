import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";
import { URL } from "url";

export interface SessionData {
  featureId: string;
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  verdict: "approved" | "changes_requested" | null;
  reviewVerdict?: "approved" | "changes_requested" | null;
  threads: SessionThread[];
  metadata: { createdAt: string; updatedAt: string };
}

export interface SessionThread {
  id: string;
  anchor: {
    type: "diff-line";
    hash: string;
    path: string;
    preview: string;
    line: number;
    lineEnd?: number;
    side: "old" | "new";
  };
  status: "open" | "resolved" | "approved" | "wontfix" | "outdated";
  severity: "critical" | "improvement" | "style" | "question";
  messages: SessionMessage[];
  lastUpdatedAt: string;
  labels?: Record<string, string>;
  resolvedByModel?: string;
  resolvedWithSeverity?: string;
}

export interface SessionMessage {
  id: string;
  authorType: "human" | "agent";
  author: string;
  text: string;
  createdAt: string;
}

export function getBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("local-review")
    .get<string>("serverUrl", "http://localhost:37003");
}

/** Node.js http/https request wrapper — works in all VS Code extension host versions. */
function httpRequest(
  url: string,
  options: { method?: string; body?: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;

    const req = mod.request(
      parsed,
      {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.body
            ? { "Content-Length": Buffer.byteLength(options.body).toString() }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/** Workspace name resolved from git repo root — set during activation. */
let _workspaceName: string | null = null;

export function setWorkspaceName(name: string): void {
  _workspaceName = name;
}

function appendWorkspaceParam(url: string): string {
  if (!_workspaceName) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}workspace=${encodeURIComponent(_workspaceName)}`;
}

async function apiFetch<T>(
  path: string,
  options?: { method?: string; body?: string },
): Promise<T> {
  const url = appendWorkspaceParam(`${getBaseUrl()}/api/features${path}`);
  const res = await httpRequest(url, {
    method: options?.method ?? "GET",
    body: options?.body,
  });
  if (res.status >= 400) {
    throw new Error(`API error: ${res.status} ${res.body}`);
  }
  return JSON.parse(res.body) as T;
}

export const serverClient = {
  async getSession(featureId: string): Promise<SessionData | null> {
    try {
      const res = await apiFetch<{ session: SessionData | null }>(
        `/${encodeURIComponent(featureId)}/code-session`,
      );
      return res.session ?? null;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        return null;
      }
      throw err;
    }
  },

  async saveSession(featureId: string, session: SessionData): Promise<void> {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session`, {
      method: "POST",
      body: JSON.stringify(session),
    });
  },

  async createThread(featureId: string, thread: SessionThread): Promise<void> {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session/threads`, {
      method: "POST",
      body: JSON.stringify(thread),
    });
  },

  async updateThread(
    featureId: string,
    threadId: string,
    patch: Partial<
      Pick<SessionThread, "status" | "severity" | "messages" | "labels">
    >,
  ): Promise<void> {
    await apiFetch(
      `/${encodeURIComponent(featureId)}/code-session/threads/${encodeURIComponent(threadId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
  },

  async setVerdict(
    featureId: string,
    verdict: "approved" | "changes_requested",
  ): Promise<void> {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session`, {
      method: "POST",
      body: JSON.stringify({ verdict }),
    });
  },

  async triggerResolve(
    featureId: string,
    sessionType: "code" | "spec" = "code",
  ): Promise<{
    ok: boolean;
    resolved?: number;
    clarifications?: number;
    error?: string;
  }> {
    const url = appendWorkspaceParam(`${getBaseUrl()}/api/resolver/resolve`);
    const res = await httpRequest(url, {
      method: "POST",
      body: JSON.stringify({ featureId, sessionType }),
    });
    return JSON.parse(res.body) as {
      ok: boolean;
      resolved?: number;
      clarifications?: number;
      error?: string;
    };
  },

  async getDiff(worktreePath: string): Promise<{
    worktreePath: string;
    sourceBranch: string;
    targetBranch: string;
    committedDiff: string;
    uncommittedDiff: string;
    allDiff: string;
  }> {
    const url = appendWorkspaceParam(
      `${getBaseUrl()}/api/diff?worktree=${encodeURIComponent(worktreePath)}`,
    );
    const res = await httpRequest(url, {});
    if (res.status >= 400) {
      throw new Error(`Diff API error: ${res.status} ${res.body}`);
    }
    return JSON.parse(res.body) as {
      worktreePath: string;
      sourceBranch: string;
      targetBranch: string;
      committedDiff: string;
      uncommittedDiff: string;
      allDiff: string;
    };
  },

  async checkConnection(): Promise<boolean> {
    try {
      const url = appendWorkspaceParam(`${getBaseUrl()}/api/features`);
      const res = await httpRequest(url, {});
      return res.status >= 200 && res.status < 400;
    } catch {
      return false;
    }
  },
};
