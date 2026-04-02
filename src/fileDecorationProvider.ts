import * as vscode from "vscode";
import { DiffStatus } from "./diffParser";
import type { DiffFileEntry } from "./diffParser";

export const SCHEME_REVIEW_FILE = "resolvr-file";

const STATUS_DECORATIONS: Record<
  DiffStatus,
  { badge: string; color: string; tooltip: string }
> = {
  [DiffStatus.Added]: {
    badge: "A",
    color: "gitDecoration.addedResourceForeground",
    tooltip: "Added",
  },
  [DiffStatus.Deleted]: {
    badge: "D",
    color: "gitDecoration.deletedResourceForeground",
    tooltip: "Deleted",
  },
  [DiffStatus.Modified]: {
    badge: "M",
    color: "gitDecoration.modifiedResourceForeground",
    tooltip: "Modified",
  },
  [DiffStatus.Renamed]: {
    badge: "R",
    color: "gitDecoration.renamedResourceForeground",
    tooltip: "Renamed",
  },
};

export function makeReviewFileUri(relativePath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SCHEME_REVIEW_FILE,
    path: "/" + relativePath.replace(/^\/+/, ""),
  });
}

export class ReviewFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChange.event;

  private _decorations = new Map<string, vscode.FileDecoration>();
  private _uris: vscode.Uri[] = [];

  setFiles(files: DiffFileEntry[]): void {
    this._decorations.clear();
    this._uris = [];

    for (const file of files) {
      const uri = makeReviewFileUri(file.path);
      const def = STATUS_DECORATIONS[file.status];
      const tooltip =
        file.status === DiffStatus.Renamed
          ? `Renamed: ${file.oldPath} → ${file.newPath}`
          : def.tooltip;

      this._decorations.set(
        uri.path,
        new vscode.FileDecoration(
          def.badge,
          tooltip,
          new vscode.ThemeColor(def.color),
        ),
      );
      this._uris.push(uri);
    }

    this._onDidChange.fire(this._uris);
  }

  clear(): void {
    const prev = this._uris;
    this._decorations.clear();
    this._uris = [];
    if (prev.length > 0) {
      this._onDidChange.fire(prev);
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== SCHEME_REVIEW_FILE) return undefined;
    return this._decorations.get(uri.path);
  }

  dispose(): void {
    this._decorations.clear();
    this._uris = [];
    this._onDidChange.dispose();
  }
}
