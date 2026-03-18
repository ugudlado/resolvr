import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Workspace {
  name: string;
  path: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "local-review");
const WORKSPACES_FILE = path.join(CONFIG_DIR, "workspaces.json");

/** Read all registered workspaces. */
export function getWorkspaces(): Workspace[] {
  try {
    const raw = fs.readFileSync(WORKSPACES_FILE, "utf-8");
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (w): w is Workspace =>
        typeof w === "object" &&
        w !== null &&
        typeof (w as Workspace).name === "string" &&
        typeof (w as Workspace).path === "string",
    );
  } catch {
    return [];
  }
}

/** Register a workspace if not already present. Returns true if newly added. */
export function registerWorkspace(repoPath: string): boolean {
  const resolved = path.resolve(
    repoPath.startsWith("~") ? os.homedir() + repoPath.slice(1) : repoPath,
  );

  // Skip git worktrees — only register actual repos (.git must be a directory, not a file)
  const gitPath = path.join(resolved, ".git");
  try {
    const stat = fs.statSync(gitPath);
    if (!stat.isDirectory()) return false; // worktree has .git as a file
  } catch {
    return false; // no .git at all
  }

  const name = path.basename(resolved);
  const workspaces = getWorkspaces();

  // Already registered (by path)?
  if (workspaces.some((w) => w.path === resolved)) return false;

  workspaces.push({ name, path: resolved });
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
  return true;
}

/** Resolve a workspace name to its absolute path. Returns null if not found. */
export function resolveWorkspace(name: string): string | null {
  const workspaces = getWorkspaces();
  const match = workspaces.find(
    (w) => w.name.toLowerCase() === name.toLowerCase(),
  );
  return match?.path ?? null;
}
