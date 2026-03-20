import { execFile } from "child_process";
import { promisify } from "util";
import { sessionStore } from "./sessionStore";

const execFileAsync = promisify(execFile);

export interface LocalDiffResult {
  worktreePath: string;
  sourceBranch: string;
  targetBranch: string;
  committedDiff: string;
  uncommittedDiff: string;
  allDiff: string;
}

async function gitExec(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (err) {
    // Git diff returns exit code 1 when there are differences — that's normal
    const execErr = err as { stdout?: string; code?: number };
    if (execErr.stdout !== undefined) {
      return execErr.stdout;
    }
    throw err;
  }
}

/**
 * Run git diff locally and return the same shape as the server's /api/diff endpoint.
 * Uses execFile (not exec) to avoid shell injection.
 */
export async function getLocalDiff(
  workspaceRoot: string,
  featureId?: string,
): Promise<LocalDiffResult> {
  // Detect source branch
  const sourceBranch = (
    await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], workspaceRoot)
  ).trim();

  // Detect target branch from session file, fallback to main
  let targetBranch = "main";
  if (featureId) {
    const session = await sessionStore.getSession(featureId);
    if (session?.targetBranch) {
      targetBranch = session.targetBranch;
    }
  }

  // Committed diff: changes between target branch and HEAD
  const committedDiff = await gitExec(
    ["diff", `${targetBranch}...HEAD`],
    workspaceRoot,
  );

  // Uncommitted diff: staged + unstaged vs HEAD
  const uncommittedDiff = await gitExec(["diff", "HEAD"], workspaceRoot);

  // All diff: everything between target branch and working tree
  const allDiff = await gitExec(["diff", targetBranch], workspaceRoot);

  return {
    worktreePath: workspaceRoot,
    sourceBranch,
    targetBranch,
    committedDiff,
    uncommittedDiff,
    allDiff,
  };
}
