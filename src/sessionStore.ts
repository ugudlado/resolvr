import * as fs from "fs";
import * as path from "path";

export interface SessionData {
  sessionId: string;
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

/** Workspace root (set during activation) — sessions live at {root}/.review/sessions/ */
let _workspaceRoot: string | null = null;
let _workspaceName: string | null = null;

export function setWorkspaceRoot(root: string): void {
  _workspaceRoot = root;
}

export function setWorkspaceName(name: string): void {
  _workspaceName = name;
}

export function getWorkspaceName(): string | null {
  return _workspaceName;
}

function getSessionsDir(): string {
  if (!_workspaceRoot) throw new Error("Workspace root not set");
  return path.join(_workspaceRoot, ".review", "sessions");
}

export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}-code.json`);
}

/** Atomic write: temp file + rename to prevent corruption on concurrent writes. */
function atomicWrite(filePath: string, data: string): void {
  _onBeforeWrite?.();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, data);
  fs.renameSync(tmpFile, filePath);
}

/** Callback invoked before every file write — used to suppress file watcher echo. */
let _onBeforeWrite: (() => void) | null = null;

export function setOnBeforeWrite(callback: () => void): void {
  _onBeforeWrite = callback;
}

function stampAndSerialize(session: SessionData): string {
  const stamped = {
    ...session,
    workspaceName: _workspaceName ?? undefined,
    metadata: { ...session.metadata, updatedAt: new Date().toISOString() },
  };
  return JSON.stringify(stamped, null, 2);
}

export const sessionStore = {
  async getSession(sessionId: string): Promise<SessionData | null> {
    const filePath = getSessionFilePath(sessionId);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(raw) as SessionData;
    } catch (err) {
      // File not found is the only case that means "no session"
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw new Error(
        `Failed to read session for ${sessionId}: ${String(err)}`,
      );
    }
  },

  saveSession(sessionId: string, session: SessionData): void {
    const filePath = getSessionFilePath(sessionId);
    atomicWrite(filePath, stampAndSerialize(session));
  },

  async createThread(
    sessionId: string,
    thread: SessionThread,
  ): Promise<SessionData> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`No session found for ${sessionId}`);
    session.threads.push(thread);
    const filePath = getSessionFilePath(sessionId);
    atomicWrite(filePath, stampAndSerialize(session));
    return session;
  },

  async updateThread(
    sessionId: string,
    threadId: string,
    patch: Partial<
      Pick<SessionThread, "status" | "severity" | "messages" | "labels">
    >,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`No session found for ${sessionId}`);
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

    const filePath = getSessionFilePath(sessionId);
    atomicWrite(filePath, stampAndSerialize(session));
  },

  async setVerdict(
    sessionId: string,
    verdict: "approved" | "changes_requested",
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`No session found for ${sessionId}`);
    session.verdict = verdict;
    const filePath = getSessionFilePath(sessionId);
    atomicWrite(filePath, stampAndSerialize(session));
  },
};
