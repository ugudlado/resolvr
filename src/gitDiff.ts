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
    // git diff exits with code 1 when there ARE differences — that's normal
    const execErr = err as {
      stdout?: string;
      code?: number;
      stderr?: string;
    };
    if (execErr.code === 1 && execErr.stdout !== undefined) {
      return execErr.stdout;
    }
    throw new Error(
      `git ${args[0]} failed (exit ${execErr.code ?? "unknown"}): ${execErr.stderr ?? String(err)}`,
    );
  }
}

/**
 * Run git diff locally and return the same shape as the server's /api/diff endpoint.
 * Uses execFile (not exec) to avoid shell injection.
 */
export async function getLocalDiff(
  workspaceRoot: string,
  sessionId?: string,
  defaultTargetBranch: string = "main",
): Promise<LocalDiffResult> {
  // Detect source branch
  const sourceBranch = (
    await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], workspaceRoot)
  ).trim();

  // Detect target branch from session file, fallback to configured default
  let targetBranch = defaultTargetBranch;
  if (sessionId) {
    const session = await sessionStore.getSession(sessionId);
    if (session?.targetBranch) {
      targetBranch = session.targetBranch;
    }
  }

  // Verify the target branch ref exists
  try {
    await gitExec(["rev-parse", "--verify", targetBranch], workspaceRoot);
  } catch {
    throw new Error(`Target branch "${targetBranch}" not found`);
  }

  // Force standard a/b prefixes regardless of diff.mnemonicprefix config
  const prefixArgs = ["--src-prefix=a/", "--dst-prefix=b/"];

  // Committed diff: changes between target branch and HEAD
  const committedDiff = await gitExec(
    ["diff", ...prefixArgs, `${targetBranch}...HEAD`],
    workspaceRoot,
  );

  // Uncommitted diff: staged + unstaged vs HEAD
  const uncommittedDiff = await gitExec(
    ["diff", ...prefixArgs, "HEAD"],
    workspaceRoot,
  );

  // All diff: everything between target branch and working tree
  const allDiff = await gitExec(
    ["diff", ...prefixArgs, targetBranch],
    workspaceRoot,
  );

  // Untracked files: new files not yet git-added
  const untrackedRaw = await gitExec(
    ["ls-files", "--others", "--exclude-standard"],
    workspaceRoot,
  );
  const untrackedFiles = untrackedRaw
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);

  // Generate synthetic unified diff headers for untracked files
  // so they appear as "Added" in the changed files tree
  const untrackedDiff = untrackedFiles
    .map(
      (f) =>
        `diff --git a/${f} b/${f}\nnew file mode 100644\n--- /dev/null\n+++ b/${f}`,
    )
    .join("\n");

  const combinedDiff = untrackedDiff ? `${allDiff}\n${untrackedDiff}` : allDiff;

  return {
    worktreePath: workspaceRoot,
    sourceBranch,
    targetBranch,
    committedDiff,
    uncommittedDiff,
    allDiff: combinedDiff,
  };
}
