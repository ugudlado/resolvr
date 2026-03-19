import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Workspace {
  name: string;
  path: string;
  addedAt?: string;
}

interface WorkspaceRegistry {
  lastActive: string | null;
  workspaces: Workspace[];
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "local-review");
const WORKSPACES_FILE = path.join(CONFIG_DIR, "workspaces.json");

/** Atomic write: temp file + rename to prevent corruption on concurrent writes. */
function atomicWriteSync(filePath: string, data: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = filePath + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmpFile, data);
  fs.renameSync(tmpFile, filePath);
}

/**
 * Read the workspace registry, auto-migrating from old array format if needed.
 * Old format: [{name, path}]
 * New format: {lastActive: "/abs/path", workspaces: [{name, path, addedAt}]}
 */
function readRegistry(): WorkspaceRegistry {
  try {
    const raw = fs.readFileSync(WORKSPACES_FILE, "utf-8");
    const data: unknown = JSON.parse(raw);

    // Old format: flat array at root
    if (Array.isArray(data)) {
      const workspaces = data.filter(
        (w): w is Workspace =>
          typeof w === "object" &&
          w !== null &&
          typeof (w as Workspace).name === "string" &&
          typeof (w as Workspace).path === "string",
      );
      const registry: WorkspaceRegistry = {
        lastActive: workspaces[0]?.path ?? null,
        workspaces,
      };
      // Auto-migrate to new format
      atomicWriteSync(WORKSPACES_FILE, JSON.stringify(registry, null, 2));
      return registry;
    }

    // New format: object with lastActive + workspaces
    if (
      typeof data === "object" &&
      data !== null &&
      "workspaces" in data &&
      Array.isArray((data as WorkspaceRegistry).workspaces)
    ) {
      const reg = data as WorkspaceRegistry;
      return {
        lastActive: typeof reg.lastActive === "string" ? reg.lastActive : null,
        workspaces: reg.workspaces.filter(
          (w): w is Workspace =>
            typeof w === "object" &&
            w !== null &&
            typeof w.name === "string" &&
            typeof w.path === "string",
        ),
      };
    }

    return { lastActive: null, workspaces: [] };
  } catch {
    return { lastActive: null, workspaces: [] };
  }
}

function writeRegistry(registry: WorkspaceRegistry): void {
  atomicWriteSync(WORKSPACES_FILE, JSON.stringify(registry, null, 2));
}

/**
 * If the path is a git worktree (.git is a file, not a directory),
 * resolve to the main repo root via `git rev-parse --git-common-dir`.
 * Returns the resolved path, or the original if not a worktree.
 * Returns null if the path has no .git at all.
 */
function resolveWorktreePath(inputPath: string): string | null {
  const gitPath = path.join(inputPath, ".git");
  try {
    const stat = fs.statSync(gitPath);
    if (stat.isDirectory()) return inputPath; // Normal repo
    // .git is a file → worktree
    try {
      const commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
        cwd: inputPath,
        encoding: "utf-8",
      }).trim();
      // commonDir is the .git dir of the main repo (e.g., /path/to/repo/.git)
      const resolved = path.resolve(inputPath, commonDir);
      return path.dirname(resolved); // strip trailing .git
    } catch {
      return null; // git command failed
    }
  } catch {
    return null; // no .git at all
  }
}

/**
 * Read all registered workspaces.
 * Filters out worktree entries (where .git is a file) that may have been
 * registered by older code before worktree auto-resolution was added.
 */
export function getWorkspaces(): Workspace[] {
  return readRegistry().workspaces.filter((w) => {
    try {
      const stat = fs.statSync(path.join(w.path, ".git"));
      return stat.isDirectory(); // real repo — keep
    } catch {
      return true; // path doesn't exist — preserve per R8 (stale workspace)
    }
  });
}

/**
 * Returns the last-active workspace path, validated for existence.
 * Falls back through the workspace list if lastActive is stale.
 * Returns null if no valid workspace found.
 */
export function getDefaultRepo(): string | null {
  const registry = readRegistry();

  // Try lastActive first
  if (registry.lastActive && fs.existsSync(registry.lastActive)) {
    return registry.lastActive;
  }

  // Fall back to first workspace that still exists on disk
  for (const ws of registry.workspaces) {
    if (fs.existsSync(ws.path)) {
      return ws.path;
    }
  }

  return null;
}

/** Update the lastActive field in the registry. */
export function setLastActive(repoPath: string): void {
  const registry = readRegistry();
  const resolved = path.resolve(repoPath);
  if (registry.lastActive === resolved) return; // no-op
  registry.lastActive = resolved;
  writeRegistry(registry);
}

/**
 * Register a workspace if not already present. Sets lastActive.
 * Worktree paths are auto-resolved to the main repo root.
 * Returns the resolved workspace, or null if the path is not a git repo.
 */
export function registerWorkspace(
  inputPath: string,
): { added: boolean; workspace: Workspace } | null {
  const expanded = inputPath.startsWith("~")
    ? os.homedir() + inputPath.slice(1)
    : inputPath;
  const absPath = path.resolve(expanded);

  // Resolve worktrees to their main repo
  const resolved = resolveWorktreePath(absPath);
  if (!resolved) return null; // not a git repo

  const name = path.basename(resolved);
  const registry = readRegistry();

  // Already registered?
  const existing = registry.workspaces.find((w) => w.path === resolved);
  if (existing) {
    // Still set lastActive since this is an explicit registration
    registry.lastActive = resolved;
    writeRegistry(registry);
    return { added: false, workspace: existing };
  }

  const workspace: Workspace = {
    name,
    path: resolved,
    addedAt: new Date().toISOString(),
  };
  registry.workspaces.push(workspace);
  registry.lastActive = resolved;
  writeRegistry(registry);
  return { added: true, workspace };
}

/**
 * Register a workspace if not already present, WITHOUT touching lastActive.
 * Used for server startup self-registration to avoid overwriting user preference.
 * Worktree paths are auto-resolved to the main repo root.
 */
export function ensureRegistered(repoPath: string): void {
  const expanded = repoPath.startsWith("~")
    ? os.homedir() + repoPath.slice(1)
    : repoPath;
  const absPath = path.resolve(expanded);

  // Resolve worktrees to their main repo
  const resolved = resolveWorktreePath(absPath);
  if (!resolved) return; // not a git repo

  const registry = readRegistry();
  if (registry.workspaces.some((w) => w.path === resolved)) return; // already registered

  registry.workspaces.push({
    name: path.basename(resolved),
    path: resolved,
    addedAt: new Date().toISOString(),
  });
  writeRegistry(registry);
}

/** Resolve a workspace name to its absolute path. Returns null if not found. */
export function resolveWorkspace(name: string): string | null {
  const workspaces = getWorkspaces();
  const match = workspaces.find(
    (w) => w.name.toLowerCase() === name.toLowerCase(),
  );
  return match?.path ?? null;
}
