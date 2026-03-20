import * as vscode from "vscode";
import type { DiffFileEntry } from "./diffParser";
import { makeReviewFileUri } from "./fileDecorationProvider";
import type { SessionThread } from "./sessionStore";

export interface DiffFileItem extends DiffFileEntry {
  openThreads: number;
}

/** Map file extensions to VS Code codicon IDs for file-type icons */
const EXT_ICON_MAP: Record<string, string> = {
  ts: "symbol-file",
  tsx: "symbol-file",
  js: "symbol-file",
  jsx: "symbol-file",
  json: "json",
  md: "markdown",
  css: "symbol-color",
  scss: "symbol-color",
  html: "code",
  svg: "symbol-misc",
  png: "file-media",
  jpg: "file-media",
  gif: "file-media",
  yaml: "list-tree",
  yml: "list-tree",
  sh: "terminal",
  bash: "terminal",
  lock: "lock",
};

function getFileIcon(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICON_MAP[ext] ?? "file";
}

/** Status color applied to file-type icon for at-a-glance scanning */
const STATUS_COLORS: Record<DiffFileEntry["status"], string> = {
  A: "gitDecoration.addedResourceForeground",
  D: "gitDecoration.deletedResourceForeground",
  M: "gitDecoration.modifiedResourceForeground",
  R: "gitDecoration.renamedResourceForeground",
};

const STATUS_LABELS: Record<DiffFileEntry["status"], string> = {
  A: "Added",
  D: "Deleted",
  M: "Modified",
  R: "Renamed",
};

export class ChangedFilesTreeProvider
  implements vscode.TreeDataProvider<DiffFileItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _files: DiffFileItem[] = [];

  setFiles(files: DiffFileEntry[]): void {
    this._files = files.map((f) => ({ ...f, openThreads: 0 }));
    this._onDidChangeTreeData.fire();
  }

  updateThreadCounts(threads: SessionThread[]): void {
    const counts = new Map<string, number>();
    for (const t of threads) {
      if (t.status !== "open") continue;
      const path = t.anchor?.path;
      if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    let changed = false;
    for (const file of this._files) {
      // For renamed files, threads may reference the old path
      const count =
        (counts.get(file.path) ?? 0) +
        (file.oldPath !== file.path ? (counts.get(file.oldPath) ?? 0) : 0);
      if (file.openThreads !== count) {
        file.openThreads = count;
        changed = true;
      }
    }
    if (changed) this._onDidChangeTreeData.fire();
  }

  get fileCount(): number {
    return this._files.length;
  }

  getFirstFile(): DiffFileItem | undefined {
    return this._files[0];
  }

  getTreeItem(element: DiffFileItem): vscode.TreeItem {
    // Filename as label for fast scanning; dir path goes in description
    const label = element.path.split("/").pop() ?? element.path;
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
    );

    // Resource URI enables FileDecorationProvider to apply colored status badges
    item.resourceUri = makeReviewFileUri(element.path);

    // Build description: dir path + diff stats + thread count
    const parts: string[] = [];

    // Directory path
    if (element.path.includes("/")) {
      parts.push(element.path.slice(0, element.path.lastIndexOf("/")));
    }

    // Diff stats (omit when zero changes — pure renames, mode changes, binary diffs)
    if (element.additions + element.deletions > 0) {
      parts.push(`+${element.additions}/\u2212${element.deletions}`);
    }

    // Thread count
    if (element.openThreads > 0) {
      const suffix = `${element.openThreads} comment${element.openThreads > 1 ? "s" : ""}`;
      parts.push(parts.length > 0 ? `\u00b7 ${suffix}` : suffix);
    }

    item.description = parts.length > 0 ? parts.join(" ") : undefined;

    // File-type icon tinted by status color for at-a-glance scanning
    item.iconPath = new vscode.ThemeIcon(
      getFileIcon(element.path),
      new vscode.ThemeColor(STATUS_COLORS[element.status]),
    );

    item.command = {
      command: "local-review.openDiffFile",
      title: "Open Diff",
      arguments: [element],
    };

    // Tooltip: status context + path + stats (not repeating visible label)
    const statusLabel = STATUS_LABELS[element.status];
    const tooltipLines = [`${statusLabel}: ${element.path}`];
    if (element.status === "R") {
      tooltipLines.push(`${element.oldPath} → ${element.newPath}`);
    }
    if (element.additions + element.deletions > 0) {
      tooltipLines.push(
        `+${element.additions} additions, ${element.deletions} deletions`,
      );
    }
    if (element.openThreads > 0) {
      tooltipLines.push(
        `${element.openThreads} open comment${element.openThreads > 1 ? "s" : ""}`,
      );
    }
    item.tooltip = tooltipLines.join("\n");

    return item;
  }

  getParent(_element: DiffFileItem): DiffFileItem | undefined {
    // Flat list — no parent hierarchy. Required for TreeView.reveal() to work.
    return undefined;
  }

  getChildren(): DiffFileItem[] {
    return this._files;
  }
}
