import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { getGitState } from "../git.js";
import type { AppEnv } from "../types.js";
import { findWorktreePath, safeId } from "../utils.js";

/** Resolve the spec.md path: active worktree first, then archived. */
function resolveSpecPath(featureId: string, repoRoot: string): string | null {
  const wtPath = findWorktreePath(featureId, repoRoot);
  if (wtPath) {
    return path.join(wtPath, "specs", "active", featureId, "spec.md");
  }
  // Fall back to archived — caller should handle ENOENT
  return path.join(repoRoot, "specs", "archived", featureId, "spec.md");
}

export function createSpecRoute(_repoRoot: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // GET /api/features/:id/spec
  app.get("/:id/spec", async (c) => {
    const repoRoot = c.get("repoRoot");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const specMdPath = resolveSpecPath(featureId, repoRoot);
    if (!specMdPath) {
      return c.json({ error: "Feature not found" }, 404);
    }

    try {
      const content = await fs.readFile(specMdPath, "utf-8");
      return c.json({
        content,
        path: `specs/active/${featureId}/spec.md`,
      });
    } catch {
      return c.json({ error: "spec.md not found" }, 404);
    }
  });

  // PUT /api/features/:id/spec
  app.put("/:id/spec", async (c) => {
    const repoRoot = c.get("repoRoot");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const specMdPath = resolveSpecPath(featureId, repoRoot);
    if (!specMdPath) {
      return c.json({ error: "Feature not found" }, 404);
    }

    const body = await c.req.json<{ content?: unknown }>();
    if (typeof body.content !== "string") {
      return c.json({ error: "content must be a string" }, 400);
    }

    try {
      await fs.writeFile(specMdPath, body.content, "utf-8");
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "Feature not found" }, 404);
    }
  });

  // GET /api/features/:id/diagrams
  app.get("/:id/diagrams", async (c) => {
    const repoRoot = c.get("repoRoot");
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const wtPath = findWorktreePath(featureId, repoRoot);
    if (!wtPath) {
      return c.json({ error: "Feature worktree not found" }, 404);
    }

    const diagramsDir = path.join(
      wtPath,
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

    return c.json({ diagrams });
  });

  // GET /api/features/:id/diagrams/:name
  app.get("/:id/diagrams/:name", async (c) => {
    const featureId = safeId(c.req.param("id"));
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const diagramName = c.req.param("name");
    if (!diagramName?.endsWith(".drawio")) {
      return c.json({ error: "Only .drawio files are allowed" }, 400);
    }
    if (
      diagramName.includes("/") ||
      diagramName.includes("\\") ||
      diagramName.includes("..")
    ) {
      return c.json({ error: "Invalid diagram name" }, 400);
    }

    const repoRoot = c.get("repoRoot");
    const wtPath = findWorktreePath(featureId, repoRoot);
    if (!wtPath) {
      return c.json({ error: "Feature worktree not found" }, 404);
    }

    const diagramFilePath = path.join(
      wtPath,
      "specs",
      "active",
      featureId,
      "diagrams",
      diagramName,
    );

    try {
      const content = await fs.readFile(diagramFilePath, "utf-8");
      return c.json({ content, name: diagramName });
    } catch {
      return c.json({ error: "Diagram not found" }, 404);
    }
  });

  // GET /api/file
  app.get("/file", async (c) => {
    const repoRoot = c.get("repoRoot");
    const worktreeParam = c.req.query("worktree");
    const filePath = c.req.query("path");

    if (!filePath) {
      return c.json({ error: "path is required" }, 400);
    }

    const gitState = getGitState(repoRoot);
    if (!gitState) {
      return c.json({ error: "git state not yet computed" }, 503);
    }

    let selectedPath: string;
    if (worktreeParam) {
      const match = gitState.worktrees.find((wt) => wt.path === worktreeParam);
      selectedPath = match ? match.path : worktreeParam;
    } else {
      selectedPath =
        gitState.worktrees.length > 0 ? gitState.worktrees[0].path : repoRoot;
    }

    const absPath = path.join(selectedPath, filePath);
    if (!absPath.startsWith(selectedPath)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const content = await fs.readFile(absPath, "utf-8");
      return c.json({ content });
    } catch {
      return c.json({ error: "File not found" }, 404);
    }
  });

  return app;
}
