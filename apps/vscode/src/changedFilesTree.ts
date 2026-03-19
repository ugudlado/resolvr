import * as vscode from "vscode";
import type { DiffFileEntry } from "./diffParser";
import type { SessionThread } from "./serverClient";

export interface DiffFileItem extends DiffFileEntry {
  openThreads: number;
}

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
    const label = element.path.split("/").pop() ?? element.path;
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
    );

    item.description = element.path.includes("/")
      ? element.path.slice(0, element.path.lastIndexOf("/"))
      : undefined;

    // Thread count suffix
    if (element.openThreads > 0) {
      item.description = `${item.description ? item.description + " " : ""}· ${element.openThreads} comment${element.openThreads > 1 ? "s" : ""}`;
    }

    // Status icons
    switch (element.status) {
      case "A":
        item.iconPath = new vscode.ThemeIcon("diff-added");
        break;
      case "D":
        item.iconPath = new vscode.ThemeIcon("diff-removed");
        break;
      case "R":
        item.iconPath = new vscode.ThemeIcon("file-renamed");
        break;
      default:
        item.iconPath = new vscode.ThemeIcon("diff-modified");
    }

    item.command = {
      command: "local-review.openDiffFile",
      title: "Open Diff",
      arguments: [element],
    };

    item.tooltip = `${element.status === "R" ? `Renamed: ${element.oldPath} → ${element.newPath}` : element.path}`;

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
