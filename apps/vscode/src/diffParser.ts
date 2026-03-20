/**
 * Lightweight diff parser.
 * Extracts file paths, statuses, and per-file diff stats from unified diff output.
 */

export interface DiffFileEntry {
  path: string; // display path (new path for renames)
  oldPath: string; // path in base ref
  newPath: string; // path in HEAD / working tree
  status: "A" | "M" | "D" | "R";
  additions: number; // lines added (from hunk content)
  deletions: number; // lines removed (from hunk content)
}

export function parseDiffFileList(unifiedDiff: string): DiffFileEntry[] {
  if (!unifiedDiff.trim()) return [];

  const blocks = unifiedDiff.split(/^diff --git /m).slice(1);
  const entries: DiffFileEntry[] = [];

  for (const block of blocks) {
    // Parse "a/<old> b/<new>" from first line
    // Greedy first group: captures everything up to the last " b/"
    const headerMatch = block.match(/^a\/(.+) b\/(.+)$/m);
    if (!headerMatch) continue;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];

    let status: DiffFileEntry["status"] = "M";
    if (/^new file mode/m.test(block)) {
      status = "A";
    } else if (/^deleted file mode/m.test(block)) {
      status = "D";
    } else if (/^rename from /m.test(block)) {
      status = "R";
    }

    // Count insertions/deletions from hunk content lines
    let additions = 0;
    let deletions = 0;
    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    entries.push({
      path: status === "D" ? oldPath : newPath,
      oldPath,
      newPath,
      status,
      additions,
      deletions,
    });
  }

  return entries;
}
