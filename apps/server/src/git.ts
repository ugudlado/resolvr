import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

export type Worktree = {
  path: string;
  branch: string;
};

export type GitState = {
  /** All local worktrees (detached HEAD entries excluded) */
  worktrees: Worktree[];
  /** All local branch names */
  localBranches: string[];
  /** Local branches not yet merged to main */
  unmergedBranches: string[];
  /** Feature IDs with archived specs (completed features) */
  archivedFeatureIds: Set<string>;
  computedAt: number;
};

const cacheMap = new Map<string, GitState>();

export async function execGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout.trimEnd();
}

export async function refreshGitState(repoRoot: string): Promise<GitState> {
  const [worktreeOutput, refsOutput, unmergedOutput] = await Promise.all([
    execGit(["worktree", "list", "--porcelain"], repoRoot),
    execGit(
      ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
      repoRoot,
    ),
    execGit(["branch", "--no-merged", "main"], repoRoot).catch(() => ""),
  ]);

  // Parse worktrees — skip entries with no branch (detached HEAD)
  const worktrees: Worktree[] = [];
  const blocks = worktreeOutput
    .split("\n\n")
    .filter((chunk) => chunk.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split("\n");
    const pathLine = lines.find((l) => l.startsWith("worktree "));
    const branchLine = lines.find((l) => l.startsWith("branch "));
    if (!pathLine || !branchLine) continue; // skip detached HEAD
    const wtPath = pathLine.slice("worktree ".length).trim();
    const branch = branchLine
      .slice("branch ".length)
      .trim()
      .replace(/^refs\/heads\//, "");
    worktrees.push({ path: wtPath, branch });
  }

  const localBranches = refsOutput
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const unmergedBranches = unmergedOutput
    .split("\n")
    .map((l) => l.replace(/^\*?\s+/, "").trim())
    .filter((l) => l.length > 0 && !["main", "master", "HEAD"].includes(l));

  // Scan archived specs to identify completed features
  const archivedDir = path.join(repoRoot, "specs", "archived");
  const archivedFeatureIds = new Set<string>();
  try {
    for (const entry of await fs.readdir(archivedDir, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) archivedFeatureIds.add(entry.name);
    }
  } catch {
    // No archived directory — that's fine
  }

  const state: GitState = {
    worktrees,
    localBranches,
    unmergedBranches,
    archivedFeatureIds,
    computedAt: Date.now(),
  };
  cacheMap.set(repoRoot, state);
  return state;
}

/** Get cached git state for a specific repo. Returns null on cache miss. */
export function getGitState(repoPath: string): GitState | null {
  return cacheMap.get(repoPath) ?? null;
}

/** Clear cached git state for a specific repo (used by watcher on change). */
export function clearGitState(repoPath: string): void {
  cacheMap.delete(repoPath);
}
