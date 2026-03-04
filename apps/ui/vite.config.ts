import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { parseTasksMarkdown } from "./src/utils/tasksParser";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const sessionsDir = path.join(repoRoot, ".review", "sessions");

type SessionPayload = {
  name: string;
  notes: string;
  targetBranch?: string;
  sourceBranch?: string;
  worktreePath?: string;
  threads?: Array<{
    id: string;
    filePath: string;
    line: number;
    lineEnd?: number;
    side: "old" | "new";
    anchorContent?: string;
    status: "open" | "resolved" | "approved";
    messages: Array<{
      id: string;
      authorType: "human" | "agent";
      author: string;
      text: string;
      createdAt: string;
    }>;
    lastUpdatedAt: string;
  }>;
  comments?: Array<{
    id: string;
    filePath: string;
    line: number;
    side: "old" | "new";
    text: string;
    createdAt: string;
  }>;
  createdAt?: string;
  reviewVerdict?: "approved" | "changes_requested" | null;
  aiReviewStatus?: "running" | "done" | null;
};

type WorktreeInfo = {
  path: string;
  branch: string;
  isCurrent: boolean;
};

type WorktreeListItem = {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
};

type FeatureInfo = {
  id: string;
  worktreePath: string;
  branch: string;
  status: string;
  hasSpec: boolean;
  hasTasks: boolean;
};

function deriveFeatureStatusServer(
  specSession: Record<string, unknown> | null,
  codeSession: Record<string, unknown> | null,
  hasSpec: boolean,
): string {
  // Check code review first (later in lifecycle)
  if (codeSession) {
    const codeVerdict = codeSession.verdict;
    if (codeVerdict === "approved") return "complete";
    if (codeVerdict === "changes_requested") return "code";
    // Code session exists but no verdict — it's in review
    return "code_review";
  }

  // Check spec review
  if (specSession) {
    const specVerdict = specSession.verdict;
    if (specVerdict === "approved") return "code";
    if (specVerdict === "changes_requested") return "design";
    // Spec session exists but no verdict — it's in review
    return "design_review";
  }

  // Has spec file but no session
  if (hasSpec) return "design";

  return "new";
}

async function ensureSessionsDir(): Promise<void> {
  await fs.mkdir(sessionsDir, { recursive: true });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function safeId(rawId: string): string | null {
  return /^[a-zA-Z0-9._-]+$/.test(rawId) ? rawId : null;
}

async function execGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout.trimEnd();
}

async function getCurrentWorktreePath(cwd: string): Promise<string> {
  return await execGit(["rev-parse", "--show-toplevel"], cwd);
}

async function getCurrentBranch(cwd: string): Promise<string> {
  return await execGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

async function listBranches(cwd: string): Promise<string[]> {
  const output = await execGit(
    ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
    cwd,
  );
  return Array.from(
    new Set(
      output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.endsWith("/HEAD")),
    ),
  );
}

function chooseDefaultTarget(branches: string[]): string {
  if (branches.includes("main")) return "main";
  if (branches.includes("origin/main")) return "origin/main";
  if (branches.includes("master")) return "master";
  if (branches.includes("origin/master")) return "origin/master";
  return branches[0] || "main";
}

async function listWorktrees(): Promise<WorktreeInfo[]> {
  const output = await execGit(["worktree", "list", "--porcelain"], repoRoot);
  const currentPath = await getCurrentWorktreePath(repoRoot);
  const blocks = output
    .split("\n\n")
    .filter((chunk) => chunk.trim().length > 0);

  const worktrees = await Promise.all(
    blocks.map(async (block) => {
      const lines = block.split("\n");
      const pathLine = lines.find((line) => line.startsWith("worktree "));
      if (!pathLine) return null;

      const wtPath = pathLine.slice("worktree ".length).trim();
      const branchLine = lines.find((line) => line.startsWith("branch "));
      let branch = branchLine
        ? branchLine.replace("branch refs/heads/", "").trim()
        : "";

      if (!branch || branch.includes("detached")) {
        try {
          branch = await getCurrentBranch(wtPath);
        } catch {
          branch = "detached";
        }
      }

      return {
        path: wtPath,
        branch,
        isCurrent: wtPath === currentPath,
      } satisfies WorktreeInfo;
    }),
  );

  return worktrees.filter((wt): wt is WorktreeInfo => Boolean(wt));
}

async function resolveWorktree(
  requestedPath: string | null,
): Promise<{ selectedPath: string; worktrees: WorktreeInfo[] }> {
  const worktrees = await listWorktrees();
  if (!requestedPath) {
    const current = worktrees.find((wt) => wt.isCurrent) || worktrees[0];
    return { selectedPath: current?.path || repoRoot, worktrees };
  }

  const found = worktrees.find((wt) => wt.path === requestedPath);
  if (!found) {
    throw new Error("Unknown worktree path");
  }

  return { selectedPath: found.path, worktrees };
}

async function getDiffBundle(
  worktreePath: string,
  requestedTarget: string | null,
  requestedSource: string | null,
) {
  const branches = await listBranches(worktreePath);
  const targetBranch =
    requestedTarget && branches.includes(requestedTarget)
      ? requestedTarget
      : chooseDefaultTarget(branches);
  const currentBranch = await getCurrentBranch(worktreePath);
  const sourceBranch =
    requestedSource && branches.includes(requestedSource)
      ? requestedSource
      : currentBranch;

  const committedDiff = await execGit(
    ["diff", "--no-color", `${targetBranch}...${sourceBranch}`],
    worktreePath,
  );
  // Uncommitted changes are only included when the source branch matches the
  // current branch, because `git diff HEAD` reports working-tree changes relative
  // to HEAD. When reviewing a different branch there is no meaningful working-tree
  // to compare against, so we skip uncommitted diff in that case.
  let uncommittedDiff = "";
  if (sourceBranch === currentBranch) {
    const trackedDiff = await execGit(
      ["diff", "--no-color", "HEAD"],
      worktreePath,
    );

    // Also include untracked files as pseudo-diffs so they appear in the file explorer
    const untrackedOutput = await execGit(
      ["ls-files", "--others", "--exclude-standard"],
      worktreePath,
    );
    const untrackedFiles = untrackedOutput.split("\n").filter(Boolean);
    const untrackedDiffs = await Promise.all(
      untrackedFiles.map(async (file) => {
        try {
          // git diff --no-index /dev/null <file> exits with code 1 when diff is non-empty
          const { stdout } = await execFileAsync(
            "git",
            ["diff", "--no-color", "--no-index", "/dev/null", file],
            { cwd: worktreePath, maxBuffer: 20 * 1024 * 1024 },
          ).catch((err: { stdout?: string; code?: number }) =>
            err.code === 1 && err.stdout
              ? { stdout: err.stdout }
              : Promise.reject(err),
          );
          return stdout;
        } catch {
          return "";
        }
      }),
    );

    uncommittedDiff = [trackedDiff, ...untrackedDiffs.filter(Boolean)].join(
      "\n",
    );
  }

  // Build allDiff without duplicating files already shown in committedDiff.
  // Extract filenames from committedDiff and exclude matching blocks from uncommittedDiff.
  let allDiff: string;
  if (!uncommittedDiff || !committedDiff) {
    allDiff = [committedDiff, uncommittedDiff].filter(Boolean).join("\n");
  } else {
    const committedFiles = new Set(
      committedDiff
        .split("\n")
        .filter((l) => l.startsWith("diff --git "))
        .map((l) => {
          const m = l.match(/ ([a-zA-Z0-9])\/(.*?)$/);
          return m ? m[2] : "";
        })
        .filter(Boolean),
    );
    // Split uncommittedDiff into per-file blocks and drop any already in committedDiff
    const blocks: string[] = [];
    let block: string[] = [];
    for (const l of uncommittedDiff.split("\n")) {
      if (l.startsWith("diff --git ")) {
        if (block.length) blocks.push(block.join("\n"));
        block = [l];
      } else {
        block.push(l);
      }
    }
    if (block.length) blocks.push(block.join("\n"));

    const newBlocks = blocks.filter((b) => {
      const m = b.match(/^diff --git [a-zA-Z0-9]\/(.*?) [a-zA-Z0-9]\//);
      return m ? !committedFiles.has(m[1]) : true;
    });
    allDiff = [committedDiff, ...newBlocks].filter(Boolean).join("\n");
  }

  return {
    worktreePath,
    sourceBranch,
    targetBranch,
    committedDiff,
    uncommittedDiff,
    allDiff,
  };
}

async function listCommits(
  worktreePath: string,
  requestedTarget: string | null,
  requestedSource: string | null,
) {
  const branches = await listBranches(worktreePath);
  const targetBranch =
    requestedTarget && branches.includes(requestedTarget)
      ? requestedTarget
      : chooseDefaultTarget(branches);
  const currentBranch = await getCurrentBranch(worktreePath);
  const sourceBranch =
    requestedSource && branches.includes(requestedSource)
      ? requestedSource
      : currentBranch;

  const output = await execGit(
    [
      "log",
      "--reverse",
      "--pretty=format:%H%x09%h%x09%ad%x09%s",
      "--date=short",
      `${targetBranch}..${sourceBranch}`,
    ],
    worktreePath,
  );

  const commits = output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [hash, shortHash, authorDate, ...subjectParts] = line.split("\t");
      return {
        hash,
        shortHash,
        authorDate,
        subject: subjectParts.join("\t"),
      };
    });

  return { commits, sourceBranch, targetBranch };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-review-api",
      configureServer(server) {
        // Watch session files and push changes to the browser via HMR WebSocket.
        // This lets external writers (e.g. Claude CLI /review-resolve) update
        // the session JSON and have the UI pick it up instantly.
        const watchPath = path.join(repoRoot, ".review", "sessions");
        server.watcher.add(watchPath);
        // Track files we just wrote (from POST /sessions) so we can skip
        // the echo back to the client that triggered the save.
        const recentlySaved = new Set<string>();

        server.watcher.on("change", (filePath: string) => {
          if (!filePath.endsWith(".json")) return;
          if (!filePath.startsWith(watchPath)) return;

          // Skip if this change was caused by our own POST /sessions save
          if (recentlySaved.delete(filePath)) return;

          void (async () => {
            try {
              const content = await fs.readFile(filePath, "utf-8");
              const session = JSON.parse(content);
              const fileName = path.basename(filePath);
              server.ws.send({
                type: "custom",
                event: "review:session-updated",
                data: { fileName, session },
              });
            } catch {
              // File may be mid-write or invalid JSON — ignore
            }
          })();
        });

        // SPA fallback: rewrite non-API, non-asset GET requests to /index.html
        // so that React Router handles client-side navigation on direct page
        // loads and refreshes (including /features/*, /, and any future routes).
        // We rewrite req.url and call next() instead of serving the file directly
        // so Vite's built-in HTML transform (HMR injection, module resolution)
        // still runs.
        server.middlewares.use((req, _res, next) => {
          const url = req.url ?? "";
          // Skip API routes
          if (url.startsWith("/local-api/")) return next();
          // Skip static assets (URLs containing a file extension)
          if (url.includes(".")) return next();
          // Skip Vite internal paths (HMR, module resolution)
          if (url.startsWith("/@")) return next();
          // Rewrite to index.html and let Vite serve it with transforms
          req.url = "/index.html";
          next();
        });

        server.middlewares.use("/local-api", async (req, res) => {
          try {
            const requestUrl = new URL(req.url || "/", "http://localhost");
            const routePath = requestUrl.pathname;

            if (req.method === "GET" && routePath === "/worktrees") {
              try {
                const output = await execGit(
                  ["worktree", "list", "--porcelain"],
                  repoRoot,
                );
                const blocks = output
                  .split("\n\n")
                  .filter((chunk) => chunk.trim().length > 0);
                const worktrees: WorktreeListItem[] = blocks.map(
                  (block, index) => {
                    const lines = block.split("\n");
                    const pathLine = lines.find((l) =>
                      l.startsWith("worktree "),
                    );
                    const headLine = lines.find((l) => l.startsWith("HEAD "));
                    const branchLine = lines.find((l) =>
                      l.startsWith("branch "),
                    );
                    const wtPath = pathLine
                      ? pathLine.slice("worktree ".length).trim()
                      : "";
                    const head = headLine
                      ? headLine.slice("HEAD ".length).trim()
                      : "";
                    let branch = "";
                    if (branchLine) {
                      branch = branchLine
                        .slice("branch ".length)
                        .trim()
                        .replace(/^refs\/heads\//, "");
                    }
                    return {
                      path: wtPath,
                      branch,
                      head,
                      isMain: index === 0,
                    };
                  },
                );
                sendJson(res, 200, { worktrees });
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "git error";
                sendJson(res, 200, { worktrees: [], error: message });
              }
              return;
            }

            if (req.method === "GET" && routePath === "/features") {
              try {
                const output = await execGit(
                  ["worktree", "list", "--porcelain"],
                  repoRoot,
                );
                const blocks = output
                  .split("\n\n")
                  .filter((chunk) => chunk.trim().length > 0);

                const parsedWorktrees = blocks.map((block) => {
                  const lines = block.split("\n");
                  const pathLine = lines.find((l) => l.startsWith("worktree "));
                  const branchLine = lines.find((l) => l.startsWith("branch "));
                  const wtPath = pathLine
                    ? pathLine.slice("worktree ".length).trim()
                    : "";
                  let branch = "";
                  if (branchLine) {
                    branch = branchLine
                      .slice("branch ".length)
                      .trim()
                      .replace(/^refs\/heads\//, "");
                  }
                  return { path: wtPath, branch };
                });

                // Filter to worktrees that have specs/active/{slug}/ directory
                const withSpecsActive = await Promise.all(
                  parsedWorktrees.map(async (wt) => {
                    if (!wt.path) return null;
                    try {
                      const slug = path.basename(wt.path);
                      await fs.access(
                        path.join(wt.path, "specs", "active", slug),
                      );
                      return wt;
                    } catch {
                      return null;
                    }
                  }),
                );

                const featureWorktrees = withSpecsActive.filter(
                  (wt): wt is { path: string; branch: string } => wt !== null,
                );

                const features = await Promise.all(
                  featureWorktrees.map(async (wt): Promise<FeatureInfo> => {
                    const featureId = path.basename(wt.path);
                    const specSessionPath = path.join(
                      repoRoot,
                      ".review",
                      "sessions",
                      `${featureId}-spec.json`,
                    );
                    const codeSessionPath = path.join(
                      repoRoot,
                      ".review",
                      "sessions",
                      `${featureId}-code.json`,
                    );

                    const [specSession, codeSession, hasSpec, hasTasks] =
                      await Promise.all([
                        (async () => {
                          try {
                            const content = await fs.readFile(
                              specSessionPath,
                              "utf-8",
                            );
                            return JSON.parse(content) as Record<
                              string,
                              unknown
                            >;
                          } catch {
                            return null;
                          }
                        })(),
                        (async () => {
                          try {
                            const content = await fs.readFile(
                              codeSessionPath,
                              "utf-8",
                            );
                            return JSON.parse(content) as Record<
                              string,
                              unknown
                            >;
                          } catch {
                            return null;
                          }
                        })(),
                        (async () => {
                          try {
                            const slug = path.basename(wt.path);
                            await fs.access(
                              path.join(
                                wt.path,
                                "specs",
                                "active",
                                slug,
                                "spec.md",
                              ),
                            );
                            return true;
                          } catch {
                            return false;
                          }
                        })(),
                        (async () => {
                          try {
                            const slug = path.basename(wt.path);
                            await fs.access(
                              path.join(
                                wt.path,
                                "specs",
                                "active",
                                slug,
                                "tasks.md",
                              ),
                            );
                            return true;
                          } catch {
                            return false;
                          }
                        })(),
                      ]);

                    let branch = wt.branch;
                    if (!branch || branch.includes("detached")) {
                      try {
                        branch = await getCurrentBranch(wt.path);
                      } catch {
                        branch = "detached";
                      }
                    }

                    return {
                      id: featureId,
                      worktreePath: wt.path,
                      branch,
                      status: deriveFeatureStatusServer(
                        specSession,
                        codeSession,
                        hasSpec,
                      ),
                      hasSpec,
                      hasTasks,
                    };
                  }),
                );

                // Also scan specs/archived/ for completed features
                const archivedDir = path.join(repoRoot, "specs", "archived");
                try {
                  const archivedEntries = await fs.readdir(archivedDir, {
                    withFileTypes: true,
                  });
                  for (const entry of archivedEntries) {
                    if (!entry.isDirectory()) continue;
                    const archivedId = entry.name;
                    // Skip if already found as active worktree feature
                    if (features.some((f) => f.id === archivedId)) continue;
                    const hasSpec = fsSync.existsSync(
                      path.join(archivedDir, archivedId, archivedId, "spec.md"),
                    );
                    const hasTasks = fsSync.existsSync(
                      path.join(
                        archivedDir,
                        archivedId,
                        archivedId,
                        "tasks.md",
                      ),
                    );
                    if (hasSpec || hasTasks) {
                      features.push({
                        id: archivedId,
                        worktreePath: repoRoot,
                        branch: "main",
                        status: "complete",
                        hasSpec,
                        hasTasks,
                      });
                    }
                  }
                } catch {
                  // No archived directory — that's fine
                }

                sendJson(res, 200, { features });
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "git error";
                sendJson(res, 200, { features: [], error: message });
              }
              return;
            }

            // GET|PUT /features/:id/spec
            if (
              (req.method === "GET" || req.method === "PUT") &&
              routePath.startsWith("/features/") &&
              routePath.endsWith("/spec")
            ) {
              const parts = routePath.split("/");
              // parts = ["", "features", id, "spec"]
              const rawFeatureId = parts[2];
              const featureId = rawFeatureId ? safeId(rawFeatureId) : null;
              if (!featureId) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }
              // Find worktree by basename
              const worktreeOutput = await execGit(
                ["worktree", "list", "--porcelain"],
                repoRoot,
              );
              const specWtBlocks = worktreeOutput
                .split("\n\n")
                .filter((chunk) => chunk.trim().length > 0);
              let specWorktreePath: string | null = null;
              for (const block of specWtBlocks) {
                const pathLine = block
                  .split("\n")
                  .find((l) => l.startsWith("worktree "));
                if (!pathLine) continue;
                const candidate = pathLine.slice("worktree ".length).trim();
                if (path.basename(candidate) === featureId) {
                  specWorktreePath = candidate;
                  break;
                }
              }
              // Fallback to archived specs if no worktree found
              let specBase: string;
              if (specWorktreePath) {
                specBase = path.join(
                  specWorktreePath,
                  "specs",
                  "active",
                  featureId,
                );
              } else {
                const archivedPath = path.join(
                  repoRoot,
                  "specs",
                  "archived",
                  featureId,
                  featureId,
                );
                if (fsSync.existsSync(archivedPath)) {
                  specBase = archivedPath;
                } else {
                  sendJson(res, 404, { error: "Feature not found" });
                  return;
                }
              }
              const specMdPath = path.join(specBase, "spec.md");

              if (req.method === "PUT") {
                const body = await readBody(req);
                const { content } = JSON.parse(body);
                if (typeof content !== "string") {
                  sendJson(res, 400, { error: "content must be a string" });
                  return;
                }
                await fs.writeFile(specMdPath, content, "utf-8");
                sendJson(res, 200, { ok: true });
                return;
              }

              try {
                const content = await fs.readFile(specMdPath, "utf-8");
                sendJson(res, 200, {
                  content,
                  path: `specs/active/${featureId}/spec.md`,
                });
              } catch {
                sendJson(res, 404, { error: "spec.md not found" });
              }
              return;
            }

            if (req.method === "GET" && routePath === "/context") {
              const requestedWorktree = requestUrl.searchParams.get("worktree");
              const { selectedPath, worktrees } =
                await resolveWorktree(requestedWorktree);
              const branches = await listBranches(selectedPath);
              const currentBranch = await getCurrentBranch(selectedPath);
              sendJson(res, 200, {
                worktrees,
                currentWorktree: selectedPath,
                branches,
                currentBranch,
                defaultTargetBranch: chooseDefaultTarget(branches),
              });
              return;
            }

            if (req.method === "GET" && routePath === "/diff") {
              const requestedWorktree = requestUrl.searchParams.get("worktree");
              const requestedTarget = requestUrl.searchParams.get("target");
              const requestedSource = requestUrl.searchParams.get("source");
              const { selectedPath } = await resolveWorktree(requestedWorktree);
              const bundle = await getDiffBundle(
                selectedPath,
                requestedTarget,
                requestedSource,
              );
              sendJson(res, 200, bundle);
              return;
            }

            if (req.method === "GET" && routePath === "/commits") {
              const requestedWorktree = requestUrl.searchParams.get("worktree");
              const requestedTarget = requestUrl.searchParams.get("target");
              const requestedSource = requestUrl.searchParams.get("source");
              const { selectedPath } = await resolveWorktree(requestedWorktree);
              const result = await listCommits(
                selectedPath,
                requestedTarget,
                requestedSource,
              );
              sendJson(res, 200, result);
              return;
            }

            if (req.method === "GET" && routePath === "/commit-diff") {
              const requestedWorktree = requestUrl.searchParams.get("worktree");
              const commit = requestUrl.searchParams.get("commit");
              if (!commit) {
                sendJson(res, 400, { error: "commit is required" });
                return;
              }
              const { selectedPath } = await resolveWorktree(requestedWorktree);
              const diff = await execGit(
                ["show", "--no-color", "--format=", commit],
                selectedPath,
              );
              sendJson(res, 200, { diff });
              return;
            }

            if (req.method === "GET" && routePath === "/sessions") {
              await ensureSessionsDir();
              const files = await fs.readdir(sessionsDir);
              const jsonFiles = files.filter((file) => file.endsWith(".json"));
              // Sort by modification time (most recent first)
              const withStats = await Promise.all(
                jsonFiles.map(async (file) => {
                  const stat = await fs.stat(path.join(sessionsDir, file));
                  return { file, mtime: stat.mtimeMs };
                }),
              );
              withStats.sort((a, b) => b.mtime - a.mtime);
              const sessions = withStats.map((s) => s.file);
              sendJson(res, 200, { sessions });
              return;
            }

            if (req.method === "GET" && routePath.startsWith("/sessions/")) {
              const rawId = routePath.slice("/sessions/".length);
              const id = safeId(rawId);
              if (!id) {
                sendJson(res, 400, { error: "Invalid session id" });
                return;
              }

              await ensureSessionsDir();
              const filePath = path.join(sessionsDir, id);
              const content = await fs.readFile(filePath, "utf-8");
              sendJson(res, 200, { session: JSON.parse(content) });
              return;
            }

            if (req.method === "POST" && routePath === "/sessions") {
              const rawBody = await readBody(req);
              const payload = JSON.parse(rawBody) as SessionPayload;

              await ensureSessionsDir();
              // Derive canonical filename from branch pair
              const sanitizeBranch = (b: string) =>
                b
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "_")
                  .slice(0, 40) || "branch";
              const src = sanitizeBranch(payload.sourceBranch || "source");
              const tgt = sanitizeBranch(payload.targetBranch || "target");
              const fileName = `${src}-vs-${tgt}.json`;
              const filePath = path.join(sessionsDir, fileName);
              const session = {
                name: payload.name,
                notes: payload.notes,
                sourceBranch: payload.sourceBranch,
                targetBranch: payload.targetBranch,
                worktreePath: payload.worktreePath,
                threads: payload.threads || [],
                comments: payload.comments || [],
                reviewVerdict: payload.reviewVerdict ?? null,
                aiReviewStatus: payload.aiReviewStatus ?? null,
                createdAt: payload.createdAt || new Date().toISOString(),
              };
              recentlySaved.add(filePath);
              await fs.writeFile(
                filePath,
                JSON.stringify(session, null, 2),
                "utf-8",
              );
              // Clear the flag after a short delay in case the watcher fires late
              setTimeout(() => recentlySaved.delete(filePath), 500);
              sendJson(res, 201, {
                fileName,
                path: `.review/sessions/${fileName}`,
              });
              return;
            }

            if (req.method === "DELETE" && routePath.startsWith("/sessions/")) {
              const rawId = routePath.slice("/sessions/".length);
              const id = safeId(rawId);
              if (!id) {
                sendJson(res, 400, { error: "Invalid session id" });
                return;
              }
              await ensureSessionsDir();
              const filePath = path.join(sessionsDir, id);
              try {
                await fs.unlink(filePath);
                res.statusCode = 204;
                res.end();
              } catch {
                sendJson(res, 404, { error: "Session not found" });
              }
              return;
            }

            // GET /features/:id/tasks
            if (
              req.method === "GET" &&
              routePath.startsWith("/features/") &&
              routePath.endsWith("/tasks")
            ) {
              const parts = routePath.split("/");
              // parts = ["", "features", id, "tasks"]
              const featureId = parts[2];
              if (!featureId || !safeId(featureId)) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }
              // Find worktree by basename
              const worktreeOutput = await execGit(
                ["worktree", "list", "--porcelain"],
                repoRoot,
              );
              const wtBlocks = worktreeOutput
                .split("\n\n")
                .filter((chunk) => chunk.trim().length > 0);
              let featureWorktreePath: string | null = null;
              for (const block of wtBlocks) {
                const pathLine = block
                  .split("\n")
                  .find((l) => l.startsWith("worktree "));
                if (!pathLine) continue;
                const wtPath = pathLine.slice("worktree ".length).trim();
                if (path.basename(wtPath) === featureId) {
                  featureWorktreePath = wtPath;
                  break;
                }
              }
              let tasksFilePath: string;
              if (featureWorktreePath) {
                tasksFilePath = path.join(
                  featureWorktreePath,
                  "specs",
                  "active",
                  featureId,
                  "tasks.md",
                );
              } else {
                const archivedTasks = path.join(
                  repoRoot,
                  "specs",
                  "archived",
                  featureId,
                  featureId,
                  "tasks.md",
                );
                if (fsSync.existsSync(archivedTasks)) {
                  tasksFilePath = archivedTasks;
                } else {
                  sendJson(res, 404, {
                    error: "Feature worktree not found",
                  });
                  return;
                }
              }
              let tasksContent: string;
              try {
                tasksContent = await fs.readFile(tasksFilePath, "utf-8");
              } catch {
                sendJson(res, 404, { error: "tasks.md not found" });
                return;
              }
              const tasks = parseTasksMarkdown(tasksContent);
              sendJson(res, 200, { tasks });
              return;
            }

            // GET /features/:id/diagrams
            if (
              req.method === "GET" &&
              routePath.startsWith("/features/") &&
              routePath.endsWith("/diagrams") &&
              routePath.split("/").length === 4
            ) {
              const parts = routePath.split("/");
              // parts = ["", "features", id, "diagrams"]
              const featureId = parts[2];
              if (!featureId || !safeId(featureId)) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }
              // Find worktree by basename
              const worktreeOutput = await execGit(
                ["worktree", "list", "--porcelain"],
                repoRoot,
              );
              const wtBlocks = worktreeOutput
                .split("\n\n")
                .filter((chunk) => chunk.trim().length > 0);
              let featureWorktreePath: string | null = null;
              for (const block of wtBlocks) {
                const pathLine = block
                  .split("\n")
                  .find((l) => l.startsWith("worktree "));
                if (!pathLine) continue;
                const wtPath = pathLine.slice("worktree ".length).trim();
                if (path.basename(wtPath) === featureId) {
                  featureWorktreePath = wtPath;
                  break;
                }
              }
              if (!featureWorktreePath) {
                sendJson(res, 404, { error: "Feature worktree not found" });
                return;
              }
              const diagramsDir = path.join(
                featureWorktreePath,
                "specs",
                "active",
                featureId,
                "diagrams",
              );
              let diagrams: string[] = [];
              try {
                const entries = await fs.readdir(diagramsDir);
                diagrams = entries.filter((f) => f.endsWith(".drawio"));
              } catch {
                // diagrams/ doesn't exist — return empty array
              }
              sendJson(res, 200, { diagrams });
              return;
            }

            // GET /features/:id/diagrams/:name
            if (
              req.method === "GET" &&
              routePath.startsWith("/features/") &&
              routePath.split("/").length === 5 &&
              routePath.split("/")[3] === "diagrams"
            ) {
              const parts = routePath.split("/");
              // parts = ["", "features", id, "diagrams", name]
              const featureId = parts[2];
              const diagramName = parts[4];
              if (!featureId || !safeId(featureId)) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }
              if (!diagramName || !diagramName.endsWith(".drawio")) {
                sendJson(res, 400, {
                  error: "Only .drawio files are allowed",
                });
                return;
              }
              // Validate diagram name doesn't contain path traversal
              if (
                diagramName.includes("/") ||
                diagramName.includes("\\") ||
                diagramName.includes("..")
              ) {
                sendJson(res, 400, { error: "Invalid diagram name" });
                return;
              }
              // Find worktree by basename
              const worktreeOutput = await execGit(
                ["worktree", "list", "--porcelain"],
                repoRoot,
              );
              const wtBlocks = worktreeOutput
                .split("\n\n")
                .filter((chunk) => chunk.trim().length > 0);
              let featureWorktreePath: string | null = null;
              for (const block of wtBlocks) {
                const pathLine = block
                  .split("\n")
                  .find((l) => l.startsWith("worktree "));
                if (!pathLine) continue;
                const wtPath = pathLine.slice("worktree ".length).trim();
                if (path.basename(wtPath) === featureId) {
                  featureWorktreePath = wtPath;
                  break;
                }
              }
              if (!featureWorktreePath) {
                sendJson(res, 404, { error: "Feature worktree not found" });
                return;
              }
              const diagramFilePath = path.join(
                featureWorktreePath,
                "specs",
                "active",
                featureId,
                "diagrams",
                diagramName,
              );
              try {
                const content = await fs.readFile(diagramFilePath, "utf-8");
                sendJson(res, 200, { content, name: diagramName });
              } catch {
                sendJson(res, 404, { error: "Diagram not found" });
              }
              return;
            }

            // --------------- Code session endpoints (/features/:id/code-session) ---------------

            const codeSessionMatch = routePath.match(
              /^\/features\/([^/]+)\/code-session(\/threads\/([^/]+))?$/,
            );

            if (codeSessionMatch) {
              const rawId = codeSessionMatch[1];
              const threadId = codeSessionMatch[3] ?? null;
              const featureId = safeId(rawId);
              if (!featureId) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }

              await ensureSessionsDir();
              const sessionFilePath = path.join(
                sessionsDir,
                `${featureId}-code.json`,
              );

              // GET /features/:id/code-session
              if (req.method === "GET" && !threadId) {
                try {
                  const content = await fs.readFile(sessionFilePath, "utf-8");
                  sendJson(res, 200, { session: JSON.parse(content) });
                } catch {
                  sendJson(res, 200, { session: null });
                }
                return;
              }

              // POST /features/:id/code-session
              if (req.method === "POST" && !threadId) {
                const rawBody = await readBody(req);
                const session = JSON.parse(rawBody);
                recentlySaved.add(sessionFilePath);
                await fs.writeFile(
                  sessionFilePath,
                  JSON.stringify(session, null, 2),
                  "utf-8",
                );
                setTimeout(() => recentlySaved.delete(sessionFilePath), 500);
                sendJson(res, 200, { ok: true });
                return;
              }

              // DELETE /features/:id/code-session
              if (req.method === "DELETE" && !threadId) {
                try {
                  await fs.unlink(sessionFilePath);
                } catch {
                  // File doesn't exist — that's fine
                }
                sendJson(res, 200, { ok: true });
                return;
              }

              // PATCH /features/:id/code-session/threads/:threadId
              if (req.method === "PATCH" && threadId) {
                let sessionContent: string;
                try {
                  sessionContent = await fs.readFile(sessionFilePath, "utf-8");
                } catch {
                  sendJson(res, 404, { error: "Session not found" });
                  return;
                }

                const session = JSON.parse(sessionContent) as {
                  threads?: Array<{
                    id: string;
                    status?: string;
                    messages?: unknown[];
                    [key: string]: unknown;
                  }>;
                  [key: string]: unknown;
                };

                const threads = session.threads ?? [];
                const threadIndex = threads.findIndex((t) => t.id === threadId);
                if (threadIndex === -1) {
                  sendJson(res, 404, { error: "Thread not found" });
                  return;
                }

                const rawBody = await readBody(req);
                const patch = JSON.parse(rawBody) as {
                  status?: string;
                  messages?: unknown[];
                };

                const updatedThread = { ...threads[threadIndex] };
                if (patch.status !== undefined) {
                  updatedThread.status = patch.status;
                }
                if (patch.messages !== undefined) {
                  updatedThread.messages = [
                    ...((updatedThread.messages as unknown[]) ?? []),
                    ...patch.messages,
                  ];
                }
                threads[threadIndex] = updatedThread;
                session.threads = threads;

                recentlySaved.add(sessionFilePath);
                await fs.writeFile(
                  sessionFilePath,
                  JSON.stringify(session, null, 2),
                  "utf-8",
                );
                setTimeout(() => recentlySaved.delete(sessionFilePath), 500);
                sendJson(res, 200, { ok: true, thread: updatedThread });
                return;
              }
            }

            // --------------- Spec session endpoints (/features/:id/spec-session) ---------------

            const specSessionRouteMatch = routePath.match(
              /^\/features\/([^/]+)\/spec-session(\/threads\/([^/]+))?$/,
            );

            if (specSessionRouteMatch) {
              const rawId = specSessionRouteMatch[1];
              const threadId = specSessionRouteMatch[3] ?? null;
              const featureId = safeId(rawId);
              if (!featureId) {
                sendJson(res, 400, { error: "Invalid feature id" });
                return;
              }

              await ensureSessionsDir();
              const specSessionFilePath = path.join(
                sessionsDir,
                `${featureId}-spec.json`,
              );

              // GET /features/:id/spec-session
              if (req.method === "GET" && !threadId) {
                try {
                  const content = await fs.readFile(
                    specSessionFilePath,
                    "utf-8",
                  );
                  sendJson(res, 200, { session: JSON.parse(content) });
                } catch {
                  sendJson(res, 200, { session: null });
                }
                return;
              }

              // POST /features/:id/spec-session
              if (req.method === "POST" && !threadId) {
                const rawBody = await readBody(req);
                const session = JSON.parse(rawBody);
                recentlySaved.add(specSessionFilePath);
                await fs.writeFile(
                  specSessionFilePath,
                  JSON.stringify(session, null, 2),
                  "utf-8",
                );
                setTimeout(
                  () => recentlySaved.delete(specSessionFilePath),
                  500,
                );
                sendJson(res, 200, { ok: true });
                return;
              }

              // DELETE /features/:id/spec-session
              if (req.method === "DELETE" && !threadId) {
                try {
                  await fs.unlink(specSessionFilePath);
                } catch {
                  // File doesn't exist — that's fine
                }
                sendJson(res, 200, { ok: true });
                return;
              }

              // PATCH /features/:id/spec-session/threads/:threadId
              if (req.method === "PATCH" && threadId) {
                let specSessionContent: string;
                try {
                  specSessionContent = await fs.readFile(
                    specSessionFilePath,
                    "utf-8",
                  );
                } catch {
                  sendJson(res, 404, { error: "Spec session not found" });
                  return;
                }

                const specSession = JSON.parse(specSessionContent) as {
                  threads?: Array<{
                    id: string;
                    status?: string;
                    messages?: unknown[];
                    lastUpdatedAt?: string;
                    [key: string]: unknown;
                  }>;
                  metadata?: { createdAt?: string; updatedAt?: string };
                  [key: string]: unknown;
                };

                const specThreads = specSession.threads ?? [];
                const specThreadIndex = specThreads.findIndex(
                  (t) => t.id === threadId,
                );
                if (specThreadIndex === -1) {
                  sendJson(res, 404, { error: "Thread not found" });
                  return;
                }

                const rawBody = await readBody(req);
                const patch = JSON.parse(rawBody) as {
                  status?: string;
                  messages?: unknown[];
                };

                const updatedSpecThread = { ...specThreads[specThreadIndex] };
                if (patch.status !== undefined) {
                  updatedSpecThread.status = patch.status;
                }
                if (patch.messages !== undefined) {
                  // Append new messages rather than replace
                  updatedSpecThread.messages = [
                    ...(updatedSpecThread.messages ?? []),
                    ...patch.messages,
                  ];
                }
                updatedSpecThread.lastUpdatedAt = new Date().toISOString();
                specThreads[specThreadIndex] = updatedSpecThread;
                specSession.threads = specThreads;
                if (specSession.metadata) {
                  specSession.metadata.updatedAt = new Date().toISOString();
                }

                recentlySaved.add(specSessionFilePath);
                await fs.writeFile(
                  specSessionFilePath,
                  JSON.stringify(specSession, null, 2),
                  "utf-8",
                );
                setTimeout(
                  () => recentlySaved.delete(specSessionFilePath),
                  500,
                );
                sendJson(res, 200, { ok: true, thread: updatedSpecThread });
                return;
              }
            }

            if (req.method === "GET" && routePath === "/file") {
              const requestedWorktree = requestUrl.searchParams.get("worktree");
              const filePath = requestUrl.searchParams.get("path");
              if (!filePath) {
                sendJson(res, 400, { error: "path is required" });
                return;
              }
              const { selectedPath } = await resolveWorktree(requestedWorktree);
              const absPath = path.join(selectedPath, filePath);
              // Ensure the resolved path stays within the worktree
              if (!absPath.startsWith(selectedPath)) {
                sendJson(res, 403, { error: "Forbidden" });
                return;
              }
              try {
                const content = await fs.readFile(absPath, "utf-8");
                sendJson(res, 200, { content });
              } catch {
                sendJson(res, 404, { error: "File not found" });
              }
              return;
            }

            sendJson(res, 404, { error: "Not found" });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unexpected error";
            sendJson(res, 500, { error: message });
          }
        });
      },
    },
  ],
  server: {
    port: 37003,
  },
  build: {
    outDir: "dist",
  },
});
