import type { ReviewThread } from "../services/localReviewApi";
import type { DiffFile } from "./diffParser";

export type Selection = {
  filePath: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
};

export type FileRow =
  | {
      kind: "folder";
      key: string;
      name: string;
      depth: number;
      path: string;
      collapsed: boolean;
    }
  | { kind: "file"; key: string; depth: number; file: DiffFile };

export type FolderNode = {
  name: string;
  path: string;
  folders: Map<string, FolderNode>;
  files: DiffFile[];
};

export function lineKey(
  filePath: string,
  line: number,
  side: "old" | "new",
): string {
  return `${filePath}:${side}:${line}`;
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function hunkDomId(filePath: string, index: number): string {
  const safe = filePath.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `hunk-${safe}-${index}`;
}

export function getLineContent(
  parsedFiles: DiffFile[],
  filePath: string,
  line: number,
  side: "old" | "new",
): string | undefined {
  const file = parsedFiles.find((f) => f.path === filePath);
  if (!file) return undefined;
  for (const hunk of file.hunks) {
    for (const l of hunk.lines) {
      const num = side === "old" ? l.oldLineNumber : l.newLineNumber;
      if (num === line) return l.content;
    }
  }
  return undefined;
}

export function isThreadOutdated(
  thread: ReviewThread,
  parsedFiles: DiffFile[],
): boolean {
  if (!thread.anchorContent) return false;
  const content = getLineContent(
    parsedFiles,
    thread.filePath,
    thread.line,
    thread.side,
  );
  return content !== thread.anchorContent;
}

export function canonicalSessionFileName(
  source: string,
  target: string,
): string {
  const sanitize = (b: string) =>
    b
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "_")
      .slice(0, 40) || "branch";
  return `${sanitize(source)}-vs-${sanitize(target)}.json`;
}

export function normalizeSelection(selection: Selection): Selection {
  return {
    ...selection,
    startLine: Math.min(selection.startLine, selection.endLine),
    endLine: Math.max(selection.startLine, selection.endLine),
  };
}

export function isLineInSelection(
  selection: Selection | null,
  filePath: string,
  side: "old" | "new",
  line: number,
): boolean {
  if (!selection) return false;
  const normalized = normalizeSelection(selection);
  return (
    normalized.filePath === filePath &&
    normalized.side === side &&
    line >= normalized.startLine &&
    line <= normalized.endLine
  );
}

export function threadAnchorKey(thread: ReviewThread): string {
  return lineKey(thread.filePath, thread.lineEnd ?? thread.line, thread.side);
}

export function threadRangeLabel(thread: ReviewThread): string {
  if (thread.lineEnd && thread.lineEnd !== thread.line) {
    return `${thread.side} ${thread.line}–${thread.lineEnd}`;
  }
  return `${thread.side} line ${thread.line}`;
}

export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Shorten a file path to just the last 2 segments for display. */
export function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length <= 2 ? filePath : parts.slice(-2).join("/");
}

/** Format a diff line range label, e.g. "L12" or "L12-L15". */
export function lineLabel(line: number, lineEnd?: number): string {
  if (lineEnd && lineEnd !== line) return `L${line}-L${lineEnd}`;
  return `L${line}`;
}

export function buildFolderRows(
  files: DiffFile[],
  collapsedFolders: Set<string>,
): FileRow[] {
  const root: FolderNode = {
    name: "",
    path: "",
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const segments = file.path.split("/");
    let cursor = root;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const nextPath = cursor.path ? `${cursor.path}/${segment}` : segment;
      if (!cursor.folders.has(segment)) {
        cursor.folders.set(segment, {
          name: segment,
          path: nextPath,
          folders: new Map(),
          files: [],
        });
      }
      const nextFolder = cursor.folders.get(segment);
      if (!nextFolder) break;
      cursor = nextFolder;
    }
    cursor.files.push(file);
  }

  const rows: FileRow[] = [];
  const walk = (node: FolderNode, depth: number) => {
    for (const folderName of Array.from(node.folders.keys()).sort()) {
      const folder = node.folders.get(folderName);
      if (!folder) continue;
      const collapsed = collapsedFolders.has(folder.path);
      rows.push({
        kind: "folder",
        key: `folder:${folder.path}`,
        name: folder.name,
        depth,
        path: folder.path,
        collapsed,
      });
      if (!collapsed) walk(folder, depth + 1);
    }
    for (const file of [...node.files].sort((a, b) =>
      a.path.localeCompare(b.path),
    )) {
      rows.push({ kind: "file", key: `file:${file.path}`, depth, file });
    }
  };

  walk(root, 0);
  return rows;
}
