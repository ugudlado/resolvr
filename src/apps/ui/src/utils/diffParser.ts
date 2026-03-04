export type DiffLineKind = "add" | "del" | "context" | "meta";
export type DiffFileStatus = "U" | "M" | "A" | "D";

export type DiffLine = {
  kind: DiffLineKind;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  oldPath: string;
  newPath: string;
  status: DiffFileStatus;
  hunks: DiffHunk[];
};

function parseHunkHeader(
  line: string,
): { oldStart: number; newStart: number } | null {
  const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    newStart: Number(match[2]),
  };
}

function parseDiffGitLine(
  line: string,
): { oldPath: string; newPath: string; newPrefix: string } | null {
  // "diff --git <oldPrefix>/<path> <newPrefix>/<path>"
  // Git uses configurable prefixes: standard a/b, but worktrees use c/i/w etc.
  // Pattern: "diff --git X/<oldPath> Y/<newPath>" where X and Y are single chars.
  // Paths may contain spaces — find the split point by scanning for " Y/" separators.
  const match = line.match(/^diff --git ([a-zA-Z])\/(.+) ([a-zA-Z])\//);
  if (!match) return null;
  const newPrefix = match[3];
  // rest = everything after "diff --git X/"
  const afterOldPrefix = line.slice("diff --git ".length + 2); // skip "X/"
  const sep = ` ${newPrefix}/`;
  let splitIdx = afterOldPrefix.lastIndexOf(sep);
  while (splitIdx > 0) {
    const oldPath = afterOldPrefix.slice(0, splitIdx);
    const newPath = afterOldPrefix.slice(splitIdx + sep.length);
    if (oldPath.length > 0 && newPath.length > 0) {
      return { oldPath, newPath, newPrefix };
    }
    splitIdx = afterOldPrefix.lastIndexOf(sep, splitIdx - 1);
  }
  return null;
}

function pickDisplayPath(
  oldPath: string,
  newPath: string,
  status: DiffFileStatus,
): string {
  if (status === "D") return oldPath;
  return newPath;
}

function cleanPath(value: string): string {
  // Strip trailing carriage returns and whitespace only (not mid-path whitespace)
  return value.replace(/[\r\t ]+$/, "");
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  if (!diff.trim()) return [];

  const files: DiffFile[] = [];
  const lines = diff.split("\n");

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  let pendingOldPath = "";
  let pendingNewPath = "";
  let pendingStatus: DiffFileStatus = "M";
  let pendingNewPrefix = "b"; // the prefix char used on the +++ line (b, w, etc.)
  let pendingRawGitLine = "";

  const ensureFile = () => {
    if (currentFile) return;
    const oldPath = cleanPath(pendingOldPath || pendingNewPath);
    const newPath = cleanPath(pendingNewPath || pendingOldPath);
    const status = pendingStatus;
    let displayPath = cleanPath(pickDisplayPath(oldPath, newPath, status));

    // Last-resort: extract path from the raw "diff --git" line using the new-side prefix
    if (!displayPath && pendingRawGitLine) {
      const sep = ` ${pendingNewPrefix}/`;
      const idx = pendingRawGitLine.lastIndexOf(sep);
      if (idx !== -1)
        displayPath = pendingRawGitLine
          .slice(idx + sep.length)
          .replace(/[\r\t ]+$/, "");
    }

    currentFile = {
      path: displayPath || oldPath || newPath,
      oldPath,
      newPath,
      status,
      hunks: [],
    };
    files.push(currentFile);
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      const parsed = parseDiffGitLine(line);
      pendingOldPath = parsed?.oldPath || "";
      pendingNewPath = parsed?.newPath || "";
      pendingNewPrefix = parsed?.newPrefix || "b";
      pendingStatus = "M";
      pendingRawGitLine = line;
      currentFile = null;
      currentHunk = null;
      continue;
    }

    if (line.startsWith("new file mode ")) {
      pendingStatus = "A";
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      pendingStatus = "D";
      continue;
    }

    if (line.startsWith("rename from ")) {
      pendingOldPath = line.slice("rename from ".length).trim();
      continue;
    }

    if (line.startsWith("rename to ")) {
      pendingNewPath = line.slice("rename to ".length).trim();
      continue;
    }

    // "--- X/<path>" where X is any single prefix char (a, c, i, w, etc.)
    if (/^--- [a-zA-Z]\//.test(line)) {
      pendingOldPath = line.slice(line.indexOf("/") + 1);
      continue;
    }

    if (line === "--- /dev/null") {
      pendingOldPath = pendingOldPath || "";
      continue;
    }

    // "+++ X/<path>" where X is any single prefix char
    if (/^\+\+\+ [a-zA-Z]\//.test(line)) {
      pendingNewPath = line.slice(line.indexOf("/") + 1);
      ensureFile();
      continue;
    }

    if (line === "+++ /dev/null") {
      ensureFile();
      continue;
    }

    if (line.startsWith("@@")) {
      ensureFile();
      const parsed = parseHunkHeader(line);
      if (!parsed || !currentFile) continue;
      const file = currentFile as DiffFile;
      oldLine = parsed.oldStart;
      newLine = parsed.newStart;
      currentHunk = { header: line, lines: [] };
      file.hunks.push(currentHunk);
      continue;
    }

    if (!currentFile || !currentHunk) {
      continue;
    }

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        kind: "add",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine,
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      currentHunk.lines.push({
        kind: "del",
        content: line.slice(1),
        oldLineNumber: oldLine,
        newLineNumber: null,
      });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      currentHunk.lines.push({
        kind: "context",
        content: line.slice(1),
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    currentHunk.lines.push({
      kind: "meta",
      content: line,
      oldLineNumber: null,
      newLineNumber: null,
    });
  }

  return files.filter(
    (file) => file.hunks.length > 0 && file.path.trim().length > 0,
  );
}
