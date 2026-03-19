/**
 * Lightweight diff header parser.
 * Extracts file paths and statuses from unified diff output.
 * Does NOT parse hunks — only file-level metadata.
 */

export interface DiffFileEntry {
  path: string; // display path (new path for renames)
  oldPath: string; // path in base ref
  newPath: string; // path in HEAD / working tree
  status: "A" | "M" | "D" | "R";
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

    entries.push({
      path: status === "D" ? oldPath : newPath,
      oldPath,
      newPath,
      status,
    });
  }

  return entries;
}
