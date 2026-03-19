import { getRequestListener } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { refreshGitState } from "./git.js";
import { repoMiddleware } from "./middleware/repo.js";
import type { AppEnv } from "./types.js";
import {
  ensureRegistered,
  getDefaultRepo,
  getWorkspaces,
  registerWorkspace,
} from "./workspaces.js";
import {
  coldStart as resolverColdStart,
  getStatus as resolverStatus,
} from "./resolver-daemon.js";
import { createContextRoute } from "./routes/context.js";
import { createFeaturesRoute } from "./routes/features.js";
import { createSessionsRoute } from "./routes/sessions.js";
import { createSpecRoute } from "./routes/spec.js";
import { createTasksRoute } from "./routes/tasks.js";
import {
  setBroadcaster,
  startGitWatcher,
  startSessionWatcher,
} from "./watcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const sessionsDir = path.join(repoRoot, ".review", "sessions");
const uiDist = path.resolve(__dirname, "../../ui/dist");
const isDev = process.argv.includes("--dev") || !!process.env.DEV;

// ---------------------------------------------------------------------------
// WebSocket broadcast
// ---------------------------------------------------------------------------

const clients = new Set<WebSocket>();

function broadcast(event: { event: string; data: unknown }): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
}

setBroadcaster(broadcast);

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono<AppEnv>();
app.use("*", cors());
app.use("/api/*", repoMiddleware(repoRoot));

// API routes
app.route("/api/features", createFeaturesRoute(repoRoot));
app.route("/api", createContextRoute(repoRoot));
app.route("/api/features", createSessionsRoute(repoRoot, broadcast));
app.route("/api/features", createSpecRoute(repoRoot));
app.route("/api/features", createTasksRoute(repoRoot));

// Workspace registry
app.get("/api/workspaces", (c) => c.json({ workspaces: getWorkspaces() }));
app.post("/api/workspaces/register", async (c) => {
  const body = await c.req.json<{ path?: string }>();
  if (!body.path) return c.json({ error: "path required" }, 400);
  const result = registerWorkspace(body.path);
  if (!result) return c.json({ ok: false, error: "not a git repository" }, 400);
  return c.json({ ok: true, added: result.added, workspace: result.workspace });
});

// Register the plugin repo on startup WITHOUT touching lastActive
ensureRegistered(repoRoot);

// Resolver daemon management
app.post("/api/resolver/cold-start", (c) => {
  void resolverColdStart(repoRoot);
  return c.json({ ok: true, message: "Cold-start initiated" });
});
app.get("/api/resolver/status", (c) => {
  return c.json(resolverStatus());
});
app.post("/api/resolver/resolve", async (c) => {
  const { featureId, sessionType } = await c.req.json();
  const suffix = sessionType === "code" ? "-code.json" : "-spec.json";
  const sessionFile = path.join(sessionsDir, `${featureId}${suffix}`);

  const openThreads = await (async () => {
    try {
      const raw = await fs.readFile(sessionFile, "utf-8");
      const s = JSON.parse(raw) as {
        threads?: Array<{
          id: string;
          filePath: string;
          line: number;
          status: string;
        }>;
      };
      return (s.threads ?? []).filter((t) => t.status === "open");
    } catch {
      return [];
    }
  })();

  if (openThreads.length === 0) {
    return c.json({ ok: true, resolved: 0, clarifications: 0, fixes: [] });
  }

  broadcast({
    event: "review:resolve-started",
    data: {
      featureId,
      sessionType,
      threadCount: openThreads.length,
      threads: openThreads.map((t) => ({
        id: t.id,
        filePath: t.filePath,
        line: t.line,
      })),
    },
  });

  try {
    const { resolve: daemonResolve } = await import("./resolver-daemon.js");
    const result = await daemonResolve(
      sessionFile,
      sessionType,
      featureId,
      repoRoot,
    );
    broadcast({
      event: "review:resolve-completed",
      data: { featureId, sessionType, ...result },
    });
    return c.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    broadcast({
      event: "review:resolve-failed",
      data: { featureId, sessionType, error: message },
    });
    return c.json({ ok: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Production-only: static files + SPA fallback
// ---------------------------------------------------------------------------

if (!isDev) {
  app.get("*", async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname.includes(".")) return next();
    const html = await fs.readFile(path.join(uiDist, "index.html"), "utf-8");
    return c.html(html);
  });

  app.use("/*", serveStatic({ root: uiDist, rewriteRequestPath: (p) => p }));
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const effectiveDefault = getDefaultRepo() ?? repoRoot;
console.log(`[local-review] Default workspace: ${effectiveDefault}`);
console.log("[local-review] Warming git state cache...");
await refreshGitState(effectiveDefault);
console.log("[local-review] Git state ready.");

startGitWatcher(effectiveDefault);
startSessionWatcher(sessionsDir);

const port = parseInt(process.env.PORT ?? "", 10) || 37003;

// Hono request listener for Node's HTTP server
const honoListener = getRequestListener(app.fetch);

// Create HTTP server first so Vite can bind its HMR WebSocket to it
const server = http.createServer();

// In dev mode, embed Vite's dev server as middleware (HMR + module transforms)
let viteMiddleware:
  | ((req: IncomingMessage, res: ServerResponse, next: () => void) => void)
  | null = null;

if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: path.resolve(__dirname, "../../ui"),
    server: {
      middlewareMode: { server },
      hmr: { server },
    },
    appType: "spa",
  });
  viteMiddleware = vite.middlewares.handle.bind(vite.middlewares);
  console.log("[local-review] Vite dev middleware attached");
}

// Route requests: API → Hono, everything else → Vite (dev) or Hono (prod)
server.on("request", (req, res) => {
  const url = req.url ?? "";

  // API routes always go to Hono
  if (url.startsWith("/api")) {
    void honoListener(req, res);
    return;
  }

  // In dev mode, non-API requests go to Vite (HMR, module transforms, SPA)
  if (viteMiddleware) {
    viteMiddleware(req, res, () => {
      void honoListener(req, res);
    });
    return;
  }

  // Production: everything through Hono (static + SPA fallback)
  void honoListener(req, res);
});

server.listen(port, () => {
  console.log(
    `[local-review] Server running at http://localhost:${port}${isDev ? " (dev)" : ""}`,
  );

  // Auto-cold-start the resolver daemon (non-blocking)
  void resolverColdStart(repoRoot);
});

// ---------------------------------------------------------------------------
// WebSocket server — app-level WS on /ws (Vite HMR uses its own path)
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req: IncomingMessage, socket, head) => {
  const url = req.url ?? "";
  if (url === "/ws" || url.startsWith("/ws?")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
  // Non-/ws upgrades (like Vite HMR) are handled by Vite's own listener
});

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});
