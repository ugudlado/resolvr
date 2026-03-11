import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { findOpenspecChangeDir, findWorktreePath, safeId } from "../utils.js";

interface ParsedTask {
  id: string;
  status: string;
  description: string;
  dependencies: string[];
  parallelizable: boolean;
  why?: string;
  files?: string;
  doneWhen?: string;
}

interface ParsedPhase {
  name: string;
  tasks: ParsedTask[];
  progress: number;
}

/** Task progress extracted from tasks.md content. */
function parseTasksMarkdown(markdown: string): {
  total: number;
  completed: number;
  inProgress: number;
  phases: ParsedPhase[];
} {
  const lines = markdown.split("\n");
  const rawPhases: Array<{ name: string; tasks: ParsedTask[] }> = [];
  let currentPhase: { name: string; tasks: ParsedTask[] } | null = null;
  let lastTask: ParsedTask | null = null;

  for (const line of lines) {
    if (/^##\s+Status Legend/.test(line)) break;
    const phaseMatch = line.match(/^##\s+(.+)$/);
    if (phaseMatch) {
      if (currentPhase) rawPhases.push(currentPhase);
      currentPhase = { name: phaseMatch[1].trim(), tasks: [] };
      lastTask = null;
      continue;
    }
    if (currentPhase) {
      const taskMatch = line.match(
        /^\s*-\s+\[([^\]]*)\]\s+(T-?\d+)[:\s]\s*(.+)$/,
      );
      if (taskMatch) {
        const marker = taskMatch[1];
        const status =
          marker === "x" || marker === "~"
            ? "done"
            : marker === "→"
              ? "in_progress"
              : "pending";
        let desc = taskMatch[3].trim();

        // Extract [P] parallelizable marker
        const parallelizable = /\[P\]\s*$/.test(desc);
        if (parallelizable) desc = desc.replace(/\s*\[P\]\s*$/, "").trim();

        // Extract inline (depends: T-1, T-2) dependencies
        const dependencies: string[] = [];
        const depMatch = desc.match(/\(depends:\s*([^)]+)\)/i);
        if (depMatch) {
          desc = desc.replace(/\s*\(depends:\s*[^)]+\)/, "").trim();
          for (const d of depMatch[1].split(",")) {
            const id = d.trim();
            if (id) dependencies.push(id);
          }
        }

        lastTask = {
          id: taskMatch[2],
          status,
          description: desc,
          dependencies,
          parallelizable,
        };
        currentPhase.tasks.push(lastTask);
        continue;
      }

      // Parse indented metadata lines belonging to the last task
      if (lastTask) {
        const whyMatch = line.match(/^\s+-\s+\*\*Why\*\*:\s*(.+)$/);
        if (whyMatch) {
          lastTask.why = whyMatch[1].trim();
          continue;
        }
        const filesMatch = line.match(/^\s+-\s+\*\*Files\*\*:\s*(.+)$/);
        if (filesMatch) {
          lastTask.files = filesMatch[1].trim();
          continue;
        }
        const doneMatch = line.match(/^\s+-\s+\*\*Done when\*\*:\s*(.+)$/);
        if (doneMatch) {
          lastTask.doneWhen = doneMatch[1].trim();
          continue;
        }
      }
    }
  }
  if (currentPhase) rawPhases.push(currentPhase);

  const phases: ParsedPhase[] = rawPhases.map((p) => {
    const done = p.tasks.filter((t) => t.status === "done").length;
    return {
      ...p,
      progress:
        p.tasks.length > 0 ? Math.round((done / p.tasks.length) * 100) : 0,
    };
  });

  const allTasks = phases.flatMap((p) => p.tasks);
  return {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.status === "done").length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    phases,
  };
}

export function createTasksRoute(repoRoot: string): Hono {
  const app = new Hono();

  // GET /api/features/:id/tasks
  app.get("/:id/tasks", async (c) => {
    const rawId = c.req.param("id");
    const featureId = safeId(rawId);
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const wtPath = findWorktreePath(featureId);
    let tasksFilePath: string | null = null;

    if (wtPath) {
      const openspecDir = await findOpenspecChangeDir(wtPath, featureId);
      if (openspecDir) {
        tasksFilePath = path.join(openspecDir, "tasks.md");
      }
      // Worktree exists but no openspec dir — don't fall through to archived
    } else {
      // No worktree — try archived specs (both legacy and new locations)
      const archivedPaths = [
        path.join(repoRoot, "specs", "archived", featureId, "tasks.md"),
        path.join(
          repoRoot,
          "openspec",
          "changes",
          "archive",
          featureId,
          "tasks.md",
        ),
      ];
      for (const p of archivedPaths) {
        try {
          await fs.access(p);
          tasksFilePath = p;
          break;
        } catch {
          // Path doesn't exist, try next
        }
      }
    }

    if (!tasksFilePath) {
      return c.json({ error: "tasks.md not found" }, 404);
    }

    let tasksContent: string;
    try {
      tasksContent = await fs.readFile(tasksFilePath, "utf-8");
    } catch {
      return c.json({ error: "tasks.md not found" }, 404);
    }

    const parsed = parseTasksMarkdown(tasksContent);
    const overallProgress =
      parsed.total > 0
        ? Math.round((parsed.completed / parsed.total) * 100)
        : 0;

    // Try to read development mode from .openspec.yaml in the same directory
    let developmentMode: "TDD" | "Non-TDD" = "Non-TDD";
    try {
      const yamlContent = await fs.readFile(
        path.join(path.dirname(tasksFilePath), ".openspec.yaml"),
        "utf-8",
      );
      const modeMatch = yamlContent.match(/^mode:\s*(.+)$/m);
      if (modeMatch && modeMatch[1].trim().toLowerCase() === "tdd") {
        developmentMode = "TDD";
      }
    } catch {
      // .openspec.yaml not found — default to Non-TDD
    }

    const tasks = {
      ...parsed,
      featureId,
      developmentMode,
      overallProgress,
    };
    return c.json({ tasks });
  });

  // PUT /api/features/:id/tasks
  app.put("/:id/tasks", async (c) => {
    const rawId = c.req.param("id");
    const featureId = safeId(rawId);
    if (!featureId) {
      return c.json({ error: "Invalid feature id" }, 400);
    }

    const wtPath = findWorktreePath(featureId);
    if (!wtPath) {
      return c.json({ error: "Feature worktree not found" }, 404);
    }

    const body = await c.req.json<{ content?: unknown }>();
    if (typeof body.content !== "string") {
      return c.json({ error: "content must be a string" }, 400);
    }

    const openspecDir = await findOpenspecChangeDir(wtPath, featureId);
    if (!openspecDir) {
      return c.json({ error: "openspec change directory not found" }, 404);
    }
    const tasksFilePath = path.join(openspecDir, "tasks.md");

    await fs.writeFile(tasksFilePath, body.content, "utf-8");
    return c.json({ ok: true });
  });

  return app;
}
