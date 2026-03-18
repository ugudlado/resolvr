import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { getGitState, refreshGitState } from "../git.js";
import os from "node:os";
import type { AppEnv } from "../types.js";
import { findOpenspecChangeDir } from "../utils.js";
import { THREAD_STATUS } from "./sessions.js";

const HOME = os.homedir();
function tildefy(p: string): string {
  return p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Session = Record<string, unknown> | null;

type FeatureStatus = "new" | "design" | "code" | "code_review" | "complete";

export interface FeatureInfo {
  id: string;
  worktreePath: string;
  branch: string;
  status: FeatureStatus;
  hasSpec: boolean;
  hasTasks: boolean;
  taskProgress: { done: number; total: number };
  codeThreadCounts: { open: number; resolved: number };
  specThreadCounts: { open: number; resolved: number };
  lastActivity: string | null;
  filesChanged: number;
  sourceType: "worktree" | "branch";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveFeatureStatus(
  codeSession: Session,
  hasOpenspecArtifacts: boolean,
): FeatureStatus {
  if (codeSession) {
    const codeVerdict = codeSession.reviewVerdict;
    if (codeVerdict === "changes_requested") return "code";
    if (codeVerdict === "approved") return "complete";
    return "code_review";
  }

  if (hasOpenspecArtifacts) return "design";

  return "new";
}

function parseTaskProgress(content: string): { done: number; total: number } {
  const checkboxes = content.match(/- \[[x→~ ]\] T-?\d+/gi) ?? [];
  const done = checkboxes.filter((c) => /- \[[x~]\]/i.test(c)).length;
  return { done, total: checkboxes.length };
}

function countSessionThreads(session: Session): {
  open: number;
  resolved: number;
} {
  if (!session) return { open: 0, resolved: 0 };
  const threads = session.threads;
  if (!Array.isArray(threads)) return { open: 0, resolved: 0 };
  let open = 0;
  let resolved = 0;
  for (const t of threads) {
    if (t && typeof t === "object" && "status" in t) {
      if (t.status === THREAD_STATUS.Open) open++;
      else if (
        t.status === THREAD_STATUS.Resolved ||
        t.status === THREAD_STATUS.Approved
      )
        resolved++;
    }
  }
  return { open, resolved };
}

async function getLastActivity(paths: string[]): Promise<string | null> {
  const stats = await Promise.all(
    paths.map((p) => fs.stat(p).catch(() => null)),
  );
  let latest: Date | null = null;
  for (const stat of stats) {
    if (stat && (!latest || stat.mtime > latest)) latest = stat.mtime;
  }
  return latest ? latest.toISOString() : null;
}

function countFilesChanged(codeSession: Session): number {
  if (!codeSession) return 0;
  const diff = codeSession.diff;
  if (typeof diff !== "string") return 0;
  const matches = diff.match(/^diff --git /gm);
  return matches ? matches.length : 0;
}

async function readJsonSession(filePath: string): Promise<Session> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createFeaturesRoute(_repoRoot: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const repoRoot = c.get("repoRoot");
    const sessionsDir = path.join(repoRoot, ".review", "sessions");
    try {
      // Use cached state for default repo, fresh state for overrides
      const isOverride = repoRoot !== _repoRoot;
      const gitState = isOverride
        ? await refreshGitState(repoRoot)
        : getGitState();
      if (!gitState) {
        return c.json({ features: [], error: "git state not yet computed" });
      }

      const features: FeatureInfo[] = [];

      // ------------------------------------------------------------------
      // 1. Active worktrees (skip index 0 — main worktree)
      // ------------------------------------------------------------------
      await Promise.all(
        gitState.worktrees.slice(1).map(async (wt) => {
          const featureId = path.basename(wt.path);
          const codeSessionPath = path.join(
            sessionsDir,
            `${featureId}-code.json`,
          );
          const openspecDir = await findOpenspecChangeDir(wt.path, featureId);

          let hasOpenspecArtifacts = false;
          let tasksContent: string | null = null;
          let lastActivity: string | null = null;
          let codeSession: Session = null;

          if (openspecDir) {
            const proposalMdPath = path.join(openspecDir, "proposal.md");
            const specMdPath = path.join(openspecDir, "spec.md");
            const designMdPath = path.join(openspecDir, "design.md");
            const tasksMdPath = path.join(openspecDir, "tasks.md");

            const results = await Promise.all([
              readJsonSession(codeSessionPath),
              fs
                .access(proposalMdPath)
                .then(() => true)
                .catch(() => false),
              fs
                .access(specMdPath)
                .then(() => true)
                .catch(() => false),
              fs
                .access(designMdPath)
                .then(() => true)
                .catch(() => false),
              fs.readFile(tasksMdPath, "utf-8").catch(() => null),
              getLastActivity([
                proposalMdPath,
                specMdPath,
                designMdPath,
                tasksMdPath,
                codeSessionPath,
              ]),
            ]);
            codeSession = results[0];
            hasOpenspecArtifacts = results[1] || results[2] || results[3];
            tasksContent = results[4];
            lastActivity = results[5];
          } else {
            [codeSession, lastActivity] = await Promise.all([
              readJsonSession(codeSessionPath),
              getLastActivity([codeSessionPath]),
            ]);
          }
          const hasTasks = tasksContent !== null;

          features.push({
            id: featureId,
            worktreePath: tildefy(wt.path),
            branch: wt.branch,
            status: deriveFeatureStatus(codeSession, hasOpenspecArtifacts),
            hasSpec: hasOpenspecArtifacts,
            hasTasks,
            taskProgress: parseTaskProgress(tasksContent ?? ""),
            codeThreadCounts: countSessionThreads(codeSession),
            specThreadCounts: { open: 0, resolved: 0 },
            lastActivity,
            filesChanged: countFilesChanged(codeSession),
            sourceType: "worktree",
          });
        }),
      );

      // ------------------------------------------------------------------
      // 2. Archived specs — completed features not already in worktrees
      // ------------------------------------------------------------------
      // Check both legacy specs/archived/ and new openspec/changes/archive/
      const archivedDirs = [
        path.join(repoRoot, "specs", "archived"),
        path.join(repoRoot, "openspec", "changes", "archive"),
      ];
      for (const archivedDir of archivedDirs) {
        try {
          const archivedEntries = await fs.readdir(archivedDir, {
            withFileTypes: true,
          });
          for (const entry of archivedEntries) {
            if (!entry.isDirectory()) continue;
            const archivedId = entry.name;
            // Skip if already found (prefer legacy path if both exist)
            if (features.some((f) => f.id === archivedId)) continue;
            const [hasSpec, hasTasks] = await Promise.all([
              fs
                .access(path.join(archivedDir, archivedId, "spec.md"))
                .then(() => true)
                .catch(() => false),
              fs
                .access(path.join(archivedDir, archivedId, "tasks.md"))
                .then(() => true)
                .catch(() => false),
            ]);
            if (hasSpec || hasTasks) {
              features.push({
                id: archivedId,
                worktreePath: tildefy(repoRoot),
                branch: "main",
                status: "complete",
                hasSpec,
                hasTasks,
                taskProgress: { done: 0, total: 0 },
                codeThreadCounts: { open: 0, resolved: 0 },
                specThreadCounts: { open: 0, resolved: 0 },
                lastActivity: null,
                filesChanged: 0,
                sourceType: "worktree",
              });
            }
          }
        } catch {
          // Directory doesn't exist — check next location
        }
      }

      // ------------------------------------------------------------------
      // 3. Unmerged branches without a worktree
      // ------------------------------------------------------------------
      const existingSlugs = new Set(features.map((f) => f.id));

      // Filter first, then process in parallel
      const branchesToProcess = gitState.unmergedBranches
        .map((branchName) => ({
          branchName,
          slug: branchName.includes("/")
            ? branchName.slice(branchName.lastIndexOf("/") + 1)
            : branchName,
        }))
        .filter(({ slug }) => !existingSlugs.has(slug));

      const branchFeatures = await Promise.all(
        branchesToProcess.map(async ({ branchName, slug }) => {
          const codeSessionPath = path.join(sessionsDir, `${slug}-code.json`);
          const [codeSession, lastActivity] = await Promise.all([
            readJsonSession(codeSessionPath),
            getLastActivity([codeSessionPath]),
          ]);

          return {
            id: slug,
            worktreePath: tildefy(repoRoot),
            branch: branchName,
            status: deriveFeatureStatus(codeSession, false),
            hasSpec: false,
            hasTasks: false,
            taskProgress: { done: 0, total: 0 },
            codeThreadCounts: countSessionThreads(codeSession),
            specThreadCounts: { open: 0, resolved: 0 },
            lastActivity,
            filesChanged: countFilesChanged(codeSession),
            sourceType: "branch" as const,
          };
        }),
      );
      features.push(...branchFeatures);

      return c.json({ features, repoName: path.basename(repoRoot) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return c.json({ features: [], error: message });
    }
  });

  return app;
}
