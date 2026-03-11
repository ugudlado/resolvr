import type { ReviewThread } from "../services/localReviewApi";
import type { DiffFile } from "./diffParser";

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
