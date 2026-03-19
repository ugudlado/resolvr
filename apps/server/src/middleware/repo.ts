import type { Context, Next } from "hono";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppEnv } from "../types.js";
import {
  getDefaultRepo,
  getWorkspaces,
  resolveWorkspace,
} from "../workspaces.js";

/** Resolve workspaceName from workspace registry, falling back to path.basename(). */
function resolveWorkspaceName(repoRoot: string): string {
  const workspace = getWorkspaces().find((w) => w.path === repoRoot);
  return workspace?.name ?? path.basename(repoRoot);
}

/**
 * Hono middleware that resolves the repo root for each request.
 *
 * Priority: `?repo=/path` (direct) > `?workspace=name` (registry lookup) > default.
 * Default: last-active workspace from registry, falling back to static repoRoot.
 *
 * Sets both `repoRoot` (absolute path) and `workspaceName` (workspace name or basename)
 * on the context for downstream route handlers.
 */
export function repoMiddleware(defaultRepoRoot: string) {
  return async (c: Context<AppEnv>, next: Next) => {
    const repoParam = c.req.query("repo");
    const workspaceParam = c.req.query("workspace");

    // No override — use last-active workspace or fallback to static default
    if (!repoParam && !workspaceParam) {
      const repoRoot = getDefaultRepo() ?? defaultRepoRoot;
      c.set("repoRoot", repoRoot);
      c.set("workspaceName", resolveWorkspaceName(repoRoot));
      return next();
    }

    // Resolve workspace name to path
    let targetPath = repoParam;
    if (!targetPath && workspaceParam) {
      const resolved = resolveWorkspace(workspaceParam);
      if (!resolved) {
        return c.json({ error: `Unknown workspace: ${workspaceParam}` }, 400);
      }
      targetPath = resolved;
    }

    if (!targetPath) {
      c.set("repoRoot", defaultRepoRoot);
      c.set("workspaceName", resolveWorkspaceName(defaultRepoRoot));
      return next();
    }

    // Reject path traversal before any resolution
    if (targetPath.includes("..")) {
      return c.json(
        { error: "Invalid repo path: path traversal not allowed" },
        400,
      );
    }

    // Expand tilde
    let resolved = targetPath;
    if (resolved.startsWith("~")) {
      resolved = os.homedir() + resolved.slice(1);
    }

    // Resolve to absolute path
    resolved = path.resolve(resolved);

    // Check path exists
    if (!fs.existsSync(resolved)) {
      return c.json(
        { error: `Invalid repo path: directory does not exist: ${resolved}` },
        400,
      );
    }

    // Check it's a git repo (.git directory or .git file for worktrees)
    const gitPath = path.join(resolved, ".git");
    if (!fs.existsSync(gitPath)) {
      return c.json(
        { error: `Invalid repo path: not a git repository: ${resolved}` },
        400,
      );
    }

    c.set("repoRoot", resolved);
    c.set("workspaceName", resolveWorkspaceName(resolved));
    return next();
  };
}
