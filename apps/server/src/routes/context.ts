import { Hono } from "hono";
import os from "node:os";
import type { GitState } from "../git.js";
import { execFileAsync, execGit, getGitState } from "../git.js";
import type { AppEnv } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Expand leading `~` or `~/` to the user's home directory. */
function expandTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return os.homedir() + p.slice(1);
  return p;
}

/** Filter branches to active ones: unmerged, worktree-attached, or main/master. */
function filterActiveBranches(state: GitState | null): string[] {
  const localBranches = state?.localBranches ?? [];
  const unmergedBranches = new Set(state?.unmergedBranches ?? []);
  const worktreeBranches = new Set(
    (state?.worktrees ?? []).map((wt) => wt.branch),
  );
  const archivedIds = state?.archivedFeatureIds ?? new Set<string>();

  return localBranches.filter((b) => {
    if (b === "main" || b === "master") return true;
    const slug = b.includes("/") ? b.slice(b.lastIndexOf("/") + 1) : b;
    if (archivedIds.has(slug) && !worktreeBranches.has(b)) return false;
    return unmergedBranches.has(b) || worktreeBranches.has(b);
  });
}

/**
 * Resolve the effective worktree path and branch for a diff/commit operation.
 * When a source branch is requested that belongs to a different worktree,
 * returns that worktree's path so uncommitted changes are included.
 */
function resolveEffectiveWorktree(
  selectedWorktree: { path: string; branch: string },
  requestedSource: string | null,
  rawWorktrees: { path: string; branch: string }[],
): { path: string; branch: string } {
  if (requestedSource) {
    const matchingWt = rawWorktrees.find((wt) => wt.branch === requestedSource);
    if (matchingWt) {
      return { path: matchingWt.path, branch: matchingWt.branch };
    }
  }
  return { path: selectedWorktree.path, branch: selectedWorktree.branch };
}

function chooseDefaultTarget(branches: string[]): string {
  if (branches.includes("main")) return "main";
  if (branches.includes("origin/main")) return "origin/main";
  if (branches.includes("master")) return "master";
  if (branches.includes("origin/master")) return "origin/master";
  return branches[0] || "main";
}

function resolveWorktree(
  requestedPath: string | null,
  repoRoot: string,
  state: GitState | null,
): { path: string; branch: string; isMain: boolean } {
  const worktrees = state?.worktrees ?? [];

  if (!requestedPath) {
    // Match the worktree whose path is the server's repoRoot (handles running from a feature worktree)
    const match = worktrees.find((wt) => wt.path === repoRoot);
    const fallback = worktrees[0];
    const chosen = match ?? fallback;
    return {
      path: chosen?.path ?? repoRoot,
      branch: chosen?.branch ?? "main",
      isMain: (chosen?.path ?? repoRoot) === (worktrees[0]?.path ?? repoRoot),
    };
  }

  const resolved = expandTilde(requestedPath);
  const found = worktrees.find((wt) => wt.path === resolved);
  if (!found) {
    throw new Error("Unknown worktree path");
  }

  return {
    path: found.path,
    branch: found.branch,
    isMain: worktrees[0]?.path === found.path,
  };
}

function resolveSourceBranch(
  requestedSource: string | null,
  currentBranch: string,
  localBranches: string[],
): string {
  if (requestedSource && localBranches.includes(requestedSource)) {
    return requestedSource;
  }
  return currentBranch;
}

function resolveTargetBranch(
  requestedTarget: string | null,
  localBranches: string[],
): string {
  if (requestedTarget && localBranches.includes(requestedTarget)) {
    return requestedTarget;
  }
  return chooseDefaultTarget(localBranches);
}

async function buildDiffBundle(
  worktreePath: string,
  requestedTarget: string | null,
  requestedSource: string | null,
  localBranches: string[],
  currentBranch: string,
) {
  const targetBranch = resolveTargetBranch(requestedTarget, localBranches);
  const sourceBranch = resolveSourceBranch(
    requestedSource,
    currentBranch,
    localBranches,
  );

  const committedDiff = await execGit(
    ["diff", "--no-color", `${targetBranch}...${sourceBranch}`],
    worktreePath,
  );

  let uncommittedDiff = "";
  if (sourceBranch === currentBranch) {
    const trackedDiff = await execGit(
      ["diff", "--no-color", "HEAD"],
      worktreePath,
    );

    const untrackedOutput = await execGit(
      ["ls-files", "--others", "--exclude-standard"],
      worktreePath,
    );
    const untrackedFiles = untrackedOutput.split("\n").filter(Boolean);
    const untrackedDiffs = await Promise.all(
      untrackedFiles.map(async (file) => {
        try {
          const { stdout } = await execFileAsync(
            "git",
            ["diff", "--no-color", "--no-index", "/dev/null", file],
            { cwd: worktreePath, maxBuffer: 20 * 1024 * 1024 },
          ).catch((err: { stdout?: string; code?: number }) =>
            err.code === 1 && err.stdout
              ? { stdout: err.stdout }
              : Promise.reject(
                  new Error(
                    String((err as { code?: number }).code ?? "unknown"),
                  ),
                ),
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

async function buildCommitList(
  worktreePath: string,
  requestedTarget: string | null,
  requestedSource: string | null,
  localBranches: string[],
  currentBranch: string,
) {
  const targetBranch = resolveTargetBranch(requestedTarget, localBranches);
  const sourceBranch = resolveSourceBranch(
    requestedSource,
    currentBranch,
    localBranches,
  );

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

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createContextRoute(_repoRoot: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // GET /context
  app.get("/context", (c) => {
    const repoRoot = c.get("repoRoot");
    const requestedWorktree = c.req.query("worktree") ?? null;
    const _requestedSource = c.req.query("source") ?? null;
    const requestedTarget = c.req.query("target") ?? null;

    const state = getGitState(repoRoot);
    const rawWorktrees = state?.worktrees ?? [];
    const localBranches = state?.localBranches ?? [];

    let selectedWorktree: ReturnType<typeof resolveWorktree>;
    try {
      selectedWorktree = resolveWorktree(requestedWorktree, repoRoot, state);
    } catch {
      return c.json({ error: "Unknown worktree path" }, 400);
    }

    const currentBranch = selectedWorktree.branch;

    const branches = filterActiveBranches(state);

    const defaultTargetBranch = resolveTargetBranch(
      requestedTarget,
      localBranches,
    );

    const worktrees = rawWorktrees.map((wt, idx) => ({
      path: wt.path,
      branch: wt.branch,
      isMain: idx === 0,
    }));

    return c.json({
      worktrees,
      currentWorktree: selectedWorktree.path,
      branches,
      currentBranch,
      defaultTargetBranch,
    });
  });

  // GET /diff
  app.get("/diff", async (c) => {
    const repoRoot = c.get("repoRoot");
    const requestedWorktree = c.req.query("worktree") ?? null;
    const requestedTarget = c.req.query("target") ?? null;
    const requestedSource = c.req.query("source") ?? null;

    const state = getGitState(repoRoot);
    let selectedWorktree: ReturnType<typeof resolveWorktree>;
    try {
      selectedWorktree = resolveWorktree(requestedWorktree, repoRoot, state);
    } catch {
      return c.json({ error: "Unknown worktree path" }, 400);
    }

    const localBranches = state?.localBranches ?? [];
    const rawWorktrees = state?.worktrees ?? [];

    const effective = resolveEffectiveWorktree(
      selectedWorktree,
      requestedSource,
      rawWorktrees,
    );

    try {
      const bundle = await buildDiffBundle(
        effective.path,
        requestedTarget,
        requestedSource,
        localBranches,
        effective.branch,
      );
      return c.json(bundle);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /commits
  app.get("/commits", async (c) => {
    const repoRoot = c.get("repoRoot");
    const requestedWorktree = c.req.query("worktree") ?? null;
    const requestedTarget = c.req.query("target") ?? null;
    const requestedSource = c.req.query("source") ?? null;

    const state = getGitState(repoRoot);
    let selectedWorktree: ReturnType<typeof resolveWorktree>;
    try {
      selectedWorktree = resolveWorktree(requestedWorktree, repoRoot, state);
    } catch {
      return c.json({ error: "Unknown worktree path" }, 400);
    }

    const localBranches = state?.localBranches ?? [];
    const rawWorktrees = state?.worktrees ?? [];

    const effective = resolveEffectiveWorktree(
      selectedWorktree,
      requestedSource,
      rawWorktrees,
    );

    try {
      const result = await buildCommitList(
        effective.path,
        requestedTarget,
        requestedSource,
        localBranches,
        effective.branch,
      );
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /commit-diff
  app.get("/commit-diff", async (c) => {
    const repoRoot = c.get("repoRoot");
    const requestedWorktree = c.req.query("worktree") ?? null;
    const commit = c.req.query("commit") ?? null;

    if (!commit) {
      return c.json({ error: "commit is required" }, 400);
    }

    const state = getGitState(repoRoot);
    let selectedWorktree: ReturnType<typeof resolveWorktree>;
    try {
      selectedWorktree = resolveWorktree(requestedWorktree, repoRoot, state);
    } catch {
      return c.json({ error: "Unknown worktree path" }, 400);
    }

    try {
      const diff = await execGit(
        ["show", "--no-color", commit],
        selectedWorktree.path,
      );
      return c.json({ diff });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /worktrees
  app.get("/worktrees", (c) => {
    const repoRoot = c.get("repoRoot");
    const state = getGitState(repoRoot);
    const rawWorktrees = state?.worktrees ?? [];
    const worktrees = rawWorktrees.map((wt, idx) => ({
      path: wt.path,
      branch: wt.branch,
      isMain: idx === 0,
    }));
    return c.json({ worktrees });
  });

  // GET /branches
  app.get("/branches", (c) => {
    const repoRoot = c.get("repoRoot");
    const branches = filterActiveBranches(getGitState(repoRoot));
    return c.json({ branches });
  });

  return app;
}
