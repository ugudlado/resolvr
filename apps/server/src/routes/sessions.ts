import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppEnv } from "../types.js";
import { safeId } from "../utils.js";
import type { Broadcaster } from "../watcher.js";

// ---------------------------------------------------------------------------
// Thread status and severity enums
// ---------------------------------------------------------------------------

export const THREAD_STATUS = {
  Open: "open",
  Resolved: "resolved",
  Approved: "approved",
} as const;

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];

export const THREAD_SEVERITY = {
  Critical: "critical",
  Improvement: "improvement",
  Style: "style",
  Question: "question",
} as const;

export type ThreadSeverity =
  (typeof THREAD_SEVERITY)[keyof typeof THREAD_SEVERITY];

// ---------------------------------------------------------------------------
// Session data structures
// ---------------------------------------------------------------------------

interface ThreadRecord {
  id: string;
  anchor?: unknown;
  status?: ThreadStatus;
  severity?: ThreadSeverity;
  messages?: unknown[];
  lastUpdatedAt?: string;
  [key: string]: unknown;
}

interface PatchPayload {
  status?: ThreadStatus;
  severity?: ThreadSeverity;
  messages?: unknown[];
  /** Arbitrary labels for analytics and filtering (e.g. { "severity": "critical", "effort": "high" }). */
  labels?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Session type configuration — eliminates code/spec duplication
// ---------------------------------------------------------------------------

type SessionType = "code" | "spec";

interface SessionConfig {
  pathSegment: string;
  fileSuffix: string;
  onPatchThread?: (
    thread: ThreadRecord,
    session: Record<string, unknown>,
  ) => void;
}

const SESSION_CONFIGS: Record<SessionType, SessionConfig> = {
  code: {
    pathSegment: "code-session",
    fileSuffix: "-code.json",
  },
  spec: {
    pathSegment: "spec-session",
    fileSuffix: "-spec.json",
    onPatchThread: (thread, session) => {
      thread.lastUpdatedAt = new Date().toISOString();
      const metadata = session.metadata as { updatedAt?: string } | undefined;
      if (metadata) {
        metadata.updatedAt = new Date().toISOString();
      }
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Generic session CRUD registration
// ---------------------------------------------------------------------------

function registerSessionCRUD(
  app: Hono<AppEnv>,
  config: SessionConfig,
  _sessionsDir: string,
  _ensureSessionsDir: () => Promise<void>,
  sessionType: SessionType,
  broadcast?: Broadcaster,
): void {
  const { pathSegment, fileSuffix, onPatchThread } = config;

  // GET
  app.get(`/:id/${pathSegment}`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return c.json({ session: JSON.parse(content) as unknown });
    } catch {
      return c.json({ session: null });
    }
  });

  // POST (save)
  app.post(`/:id/${pathSegment}`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    const session = await c.req.json<Record<string, unknown>>();

    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");

    return c.json({ ok: true });
  });

  // DELETE
  app.delete(`/:id/${pathSegment}`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    try {
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist — that's fine
    }

    return c.json({ ok: true });
  });

  // PATCH thread
  app.patch(`/:id/${pathSegment}/threads/:threadId`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }
    const threadId = c.req.param("threadId");

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    let sessionContent: string;
    try {
      sessionContent = await fs.readFile(filePath, "utf-8");
    } catch {
      return c.json({ error: "Session not found" }, 404);
    }

    const session = JSON.parse(sessionContent) as {
      threads?: ThreadRecord[];
      [key: string]: unknown;
    };

    const threads = session.threads ?? [];
    const threadIndex = threads.findIndex((t) => t.id === threadId);
    if (threadIndex === -1) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const patch = await c.req.json<PatchPayload>();

    const updatedThread = { ...threads[threadIndex] };
    if (patch.status !== undefined) {
      updatedThread.status = patch.status;
    }
    if (patch.severity !== undefined) {
      updatedThread.severity = patch.severity;
    }
    if (patch.messages !== undefined) {
      updatedThread.messages = [
        ...(updatedThread.messages ?? []),
        ...patch.messages,
      ];
    }
    if (patch.labels !== undefined) {
      updatedThread.labels = {
        ...(updatedThread.labels ?? {}),
        ...patch.labels,
      };
    }

    onPatchThread?.(updatedThread, session);

    threads[threadIndex] = updatedThread;
    session.threads = threads;

    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");

    // Broadcast session-updated on every PATCH so VS Code extension sees
    // replies and status changes in real-time
    if (broadcast) {
      const fileName = `${featureId}${fileSuffix}`;
      broadcast({
        event: "review:session-updated",
        data: { fileName, session },
      });
    }

    // Also broadcast per-thread completion for real-time sidebar progress
    if (broadcast && updatedThread.status === THREAD_STATUS.Resolved) {
      broadcast({
        event: "review:resolve-thread-done",
        data: {
          featureId,
          threadId,
          filePath: (updatedThread as Record<string, unknown>).filePath ?? "",
          line: (updatedThread as Record<string, unknown>).line ?? 0,
          outcome: "resolved",
        },
      });
    }

    return c.json({ ok: true, thread: updatedThread });
  });

  // GET threads — return threads array only (lightweight, no full session envelope)
  app.get(`/:id/${pathSegment}/threads`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const session = JSON.parse(content) as { threads?: ThreadRecord[] };
      return c.json({ threads: session.threads ?? [] });
    } catch {
      return c.json({ threads: [] });
    }
  });

  // POST threads — create an individual thread and append to session
  app.post(`/:id/${pathSegment}/threads`, async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = path.join(sessionsDir, `${featureId}${fileSuffix}`);

    const thread = await c.req.json<ThreadRecord>();

    // Validate required fields
    if (
      !thread.id ||
      thread.anchor === undefined ||
      !thread.status ||
      !thread.messages
    ) {
      return c.json(
        { error: "Thread must have id, anchor, status, and messages" },
        400,
      );
    }

    let session: {
      threads?: ThreadRecord[];
      metadata?: { updatedAt?: string };
      [key: string]: unknown;
    };
    try {
      const content = await fs.readFile(filePath, "utf-8");
      session = JSON.parse(content) as typeof session;
    } catch {
      return c.json({ error: "Session not found" }, 404);
    }

    const threads = session.threads ?? [];
    threads.push(thread);
    session.threads = threads;

    if (session.metadata) {
      session.metadata.updatedAt = new Date().toISOString();
    }

    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");

    if (broadcast) {
      const fileName = `${featureId}${fileSuffix}`;
      broadcast({
        event: "review:session-updated",
        data: { fileName, session },
      });
    }

    return c.json({ thread }, 201);
  });
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createSessionsRoute(
  repoRoot: string,
  broadcast?: Broadcaster,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Register both code and spec session CRUD
  for (const [type, config] of Object.entries(SESSION_CONFIGS)) {
    registerSessionCRUD(
      app,
      config,
      path.join(repoRoot, ".review", "sessions"),
      async () => {},
      type as SessionType,
      broadcast,
    );
  }

  return app;
}
