import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface SessionData {
  featureId: string;
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  verdict: "approved" | "changes_requested" | null;
  reviewVerdict?: "approved" | "changes_requested" | null;
  threads: SessionThread[];
  metadata: { createdAt: string; updatedAt: string };
  workspaceName?: string;
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

/** Workspace name resolved from git repo root — set during activation. */
let _workspaceName: string | null = null;

export function setWorkspaceName(name: string): void {
  _workspaceName = name;
}

export function getWorkspaceName(): string | null {
  return _workspaceName;
}

function getSessionsDir(): string {
  if (!_workspaceName) throw new Error("Workspace name not set");
  return path.join(
    os.homedir(),
    ".config",
    "local-review",
    "workspace",
    _workspaceName,
    "sessions",
  );
}

export function getSessionFilePath(featureId: string): string {
  return path.join(getSessionsDir(), `${featureId}-code.json`);
}

/** Atomic write: temp file + rename to prevent corruption on concurrent writes. */
function atomicWrite(filePath: string, data: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, data);
  fs.renameSync(tmpFile, filePath);
}

function stampAndSerialize(session: SessionData): string {
  session.workspaceName = _workspaceName ?? undefined;
  session.metadata.updatedAt = new Date().toISOString();
  return JSON.stringify(session, null, 2);
}

export const sessionStore = {
  async getSession(featureId: string): Promise<SessionData | null> {
    const filePath = getSessionFilePath(featureId);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  },

  saveSession(featureId: string, session: SessionData): void {
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  },

  async createThread(
    featureId: string,
    thread: SessionThread,
  ): Promise<SessionData> {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    session.threads.push(thread);
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
    return session;
  },

  async updateThread(
    featureId: string,
    threadId: string,
    patch: Partial<
      Pick<SessionThread, "status" | "severity" | "messages" | "labels">
    >,
  ): Promise<void> {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    const thread = session.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    if (patch.status !== undefined) thread.status = patch.status;
    if (patch.severity !== undefined) thread.severity = patch.severity;
    if (patch.labels) {
      thread.labels = { ...thread.labels, ...patch.labels };
    }
    // Messages are appended, not replaced (matches server behavior)
    if (patch.messages) {
      thread.messages.push(...patch.messages);
    }
    thread.lastUpdatedAt = new Date().toISOString();

    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  },

  async setVerdict(
    featureId: string,
    verdict: "approved" | "changes_requested",
  ): Promise<void> {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    session.verdict = verdict;
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  },
};
