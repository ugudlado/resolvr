import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { atomicWriteSync } from "./fs-utils.js";

/** Lazily resolved to support test injection via setConfigDir(). */
let configDir: string | null = null;

function getConfigDir(): string {
  if (!configDir)
    configDir = path.join(os.homedir(), ".config", "local-review");
  return configDir;
}

/** Override the config directory root (for testing). */
export function setConfigDir(dir: string): void {
  configDir = dir;
}

/**
 * Returns the central sessions directory for a given workspace.
 * Creates the directory if it does not exist.
 */
export function getSessionsDir(workspaceName: string): string {
  const dir = path.join(getConfigDir(), "workspace", workspaceName, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Read a session file, checking central location first, then legacy fallback.
 * Returns { content, source } where source indicates where it was found.
 */
export async function readSessionFile(
  workspaceName: string,
  repoRoot: string,
  fileName: string,
): Promise<{ content: string; source: "central" | "legacy" } | null> {
  const centralPath = path.join(getSessionsDir(workspaceName), fileName);
  try {
    const content = await fs.promises.readFile(centralPath, "utf-8");
    return { content, source: "central" };
  } catch {
    // Fall back to legacy location
    const legacyPath = path.join(repoRoot, ".review", "sessions", fileName);
    try {
      const content = await fs.promises.readFile(legacyPath, "utf-8");
      return { content, source: "legacy" };
    } catch {
      return null;
    }
  }
}

/**
 * Write a session file to the central location using atomic write.
 * Always stamps workspaceName on the session data (R6).
 */
export function writeSessionFile(
  workspaceName: string,
  fileName: string,
  data: string,
): void {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    parsed.workspaceName = workspaceName;
    data = JSON.stringify(parsed, null, 2);
  } catch {
    // If data isn't valid JSON, write as-is
  }
  const filePath = path.join(getSessionsDir(workspaceName), fileName);
  atomicWriteSync(filePath, data);
}

/**
 * Delete a session file from the central location.
 * Also attempts to delete from legacy location.
 */
export async function deleteSessionFile(
  workspaceName: string,
  repoRoot: string,
  fileName: string,
): Promise<void> {
  const centralPath = path.join(getSessionsDir(workspaceName), fileName);
  const legacyPath = path.join(repoRoot, ".review", "sessions", fileName);
  await fs.promises.unlink(centralPath).catch(() => {});
  await fs.promises.unlink(legacyPath).catch(() => {});
}

/**
 * Migrate sessions from a repo's legacy .review/sessions/ to central storage.
 * Copies (not moves) files. Adds workspaceName field to migrated sessions.
 * Uses newer-wins conflict resolution.
 */
export async function migrateRepoSessions(
  workspaceName: string,
  repoPath: string,
): Promise<{ migrated: number; skipped: number }> {
  const legacyDir = path.join(repoPath, ".review", "sessions");
  const centralDir = getSessionsDir(workspaceName);
  let migrated = 0;
  let skipped = 0;

  let entries: string[];
  try {
    entries = await fs.promises.readdir(legacyDir);
  } catch {
    return { migrated: 0, skipped: 0 };
  }

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const srcPath = path.join(legacyDir, entry);
    const destPath = path.join(centralDir, entry);

    try {
      const raw = await fs.promises.readFile(srcPath, "utf-8");
      const session = JSON.parse(raw) as Record<string, unknown>;

      // Newer-wins conflict resolution
      try {
        const destRaw = await fs.promises.readFile(destPath, "utf-8");
        const destSession = JSON.parse(destRaw) as Record<string, unknown>;
        const srcMeta = session.metadata as { updatedAt?: string } | undefined;
        const destMeta = destSession.metadata as
          | { updatedAt?: string }
          | undefined;
        const srcTime = srcMeta?.updatedAt
          ? new Date(srcMeta.updatedAt).getTime()
          : (await fs.promises.stat(srcPath)).mtimeMs;
        const destTime = destMeta?.updatedAt
          ? new Date(destMeta.updatedAt).getTime()
          : (await fs.promises.stat(destPath)).mtimeMs;
        if (destTime >= srcTime) {
          skipped++;
          continue;
        }
      } catch {
        // Destination doesn't exist — proceed with migration
      }

      session.workspaceName = workspaceName;
      atomicWriteSync(destPath, JSON.stringify(session, null, 2));
      migrated++;
    } catch {
      // Skip malformed files
    }
  }

  return { migrated, skipped };
}
