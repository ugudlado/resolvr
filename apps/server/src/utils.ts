import fs from "node:fs/promises";
import path from "node:path";
import { getOrRefreshGitState } from "./git.js";

const FEATURE_ID_RE = /^[a-zA-Z0-9._-]+$/;

/** Validate and return a feature ID, or null if invalid. */
export function safeId(raw: string): string | null {
  return FEATURE_ID_RE.test(raw) ? raw : null;
}

/** Find a worktree path by feature ID (basename of worktree path). */
export async function findWorktreePath(
  featureId: string,
  repoRoot: string,
): Promise<string | null> {
  const gitState = await getOrRefreshGitState(repoRoot);
  const wt = gitState.worktrees.find(
    (w) => path.basename(w.path) === featureId,
  );
  return wt ? wt.path : null;
}

/**
 * Find the openspec change directory for a feature within a worktree.
 * The change dir may use a slug (e.g. "openspec-dev-workflow") that differs
 * from the full feature ID (e.g. "2026-03-12-openspec-dev-workflow").
 * Strategy: try exact match first, then scan .openspec.yaml files for matching feature-id.
 */
export async function findOpenspecChangeDir(
  wtPath: string,
  featureId: string,
): Promise<string | null> {
  const changesDir = path.join(wtPath, "openspec", "changes");

  // Fast path: exact match on full feature ID
  const exactDir = path.join(changesDir, featureId);
  try {
    const stat = await fs.stat(exactDir);
    if (stat.isDirectory()) return exactDir;
  } catch {
    // Not found — try slug below
  }

  // Fast path: slug match (strip leading date "YYYY-MM-DD-" or "XX-NNN-" Linear prefix)
  const slugMatch =
    featureId.match(/^\d{4}-\d{2}-\d{2}-(.+)$/) ??
    featureId.match(/^[A-Z]+-\d+-(.+)$/);
  if (slugMatch) {
    const slugDir = path.join(changesDir, slugMatch[1]);
    try {
      const stat = await fs.stat(slugDir);
      if (stat.isDirectory()) return slugDir;
    } catch {
      // Not found — scan below
    }
  }

  // Scan subdirectories in parallel for matching .openspec.yaml feature-id
  try {
    const entries = await fs.readdir(changesDir, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter((e) => e.isDirectory() && e.name !== "archive")
        .map(async (entry) => {
          const yamlPath = path.join(changesDir, entry.name, ".openspec.yaml");
          try {
            const content = await fs.readFile(yamlPath, "utf-8");
            const match = content.match(/^feature-id:\s*(.+)$/m);
            if (match?.[1].trim() === featureId) {
              return path.join(changesDir, entry.name);
            }
          } catch {
            // No .openspec.yaml in this dir — skip
          }
          return null;
        }),
    );
    return results.find((r) => r !== null) ?? null;
  } catch {
    // No openspec/changes dir — no artifacts
  }

  return null;
}
