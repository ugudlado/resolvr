import * as vscode from "vscode";
import {
  BaseContentProvider,
  SCHEME_BASE,
  SCHEME_EMPTY,
} from "./baseContentProvider";
import { ChangedFilesTreeProvider } from "./changedFilesTree";
import type { DiffFileItem } from "./changedFilesTree";
import { parseDiffFileList } from "./diffParser";
import type { DiffFileEntry } from "./diffParser";
import { serverClient } from "./serverClient";
import type { SessionThread } from "./serverClient";

export class DiffPanelManager implements vscode.Disposable {
  private _files: DiffFileEntry[] = [];
  private _baseProvider: BaseContentProvider;
  private _treeProvider: ChangedFilesTreeProvider;
  private _workspaceRoot: string;
  private _outputChannel: vscode.OutputChannel;
  private _treeView: vscode.TreeView<DiffFileItem>;

  get treeProvider(): ChangedFilesTreeProvider {
    return this._treeProvider;
  }

  constructor(
    workspaceRoot: string,
    baseProvider: BaseContentProvider,
    outputChannel: vscode.OutputChannel,
  ) {
    this._workspaceRoot = workspaceRoot;
    this._baseProvider = baseProvider;
    this._outputChannel = outputChannel;
    this._treeProvider = new ChangedFilesTreeProvider();

    this._treeView = vscode.window.createTreeView("localReview.changedFiles", {
      treeDataProvider: this._treeProvider,
    });
  }

  async open(featureId: string): Promise<void> {
    try {
      const diff = await serverClient.getDiff(this._workspaceRoot);
      this._files = parseDiffFileList(diff.allDiff);

      if (this._files.length === 0) {
        void vscode.window.showInformationMessage(
          "No changes found between main and working tree.",
        );
        return;
      }

      this._treeProvider.setFiles(this._files);
      this._treeView.title = `Changed Files (${this._files.length})`;

      // Set context key to show the tree view
      void vscode.commands.executeCommand(
        "setContext",
        "local-review.hasDiffPanel",
        true,
      );

      // Reveal the tree view using actual item reference
      const firstItem = this._treeProvider.getFirstFile();
      if (firstItem) {
        void this._treeView.reveal(firstItem, { focus: true });
      }

      // Open the first file's diff
      await this.openFile(this._files[0]);

      this._outputChannel.appendLine(
        `Diff panel opened for ${featureId}: ${this._files.length} files changed`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._outputChannel.appendLine(`Failed to open diff panel: ${msg}`);
      void vscode.window.showErrorMessage(
        `Local Review: Failed to load diff — ${msg}`,
      );
      this._treeProvider.setFiles([]);
    }
  }

  async openFile(file: DiffFileEntry): Promise<void> {
    let oldUri: vscode.Uri;
    let newUri: vscode.Uri;

    switch (file.status) {
      case "D":
        // Deleted file: old has content, new is empty
        oldUri = vscode.Uri.parse(`${SCHEME_BASE}:/${file.oldPath}`);
        newUri = vscode.Uri.parse(`${SCHEME_EMPTY}:/${file.oldPath}`);
        break;
      case "A":
        // New file: old is empty, new is working tree
        oldUri = vscode.Uri.parse(`${SCHEME_EMPTY}:/${file.newPath}`);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      case "R":
        // Renamed: old path for base, new path for working tree
        oldUri = vscode.Uri.parse(`${SCHEME_BASE}:/${file.oldPath}`);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      default:
        // Modified: base content vs working tree
        oldUri = vscode.Uri.parse(`${SCHEME_BASE}:/${file.path}`);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.path}`);
    }

    const title =
      file.status === "R"
        ? `${file.oldPath} → ${file.newPath} (Review Diff)`
        : `${file.path} (Review Diff)`;

    await vscode.commands.executeCommand("vscode.diff", oldUri, newUri, title);
  }

  async refresh(featureId: string): Promise<void> {
    this._baseProvider.invalidate();
    await this.open(featureId);
  }

  close(): void {
    this._treeProvider.setFiles([]);
    this._files = [];
    void vscode.commands.executeCommand(
      "setContext",
      "local-review.hasDiffPanel",
      false,
    );
  }

  updateThreadCounts(threads: SessionThread[]): void {
    if (this._files.length === 0) return;
    this._treeProvider.updateThreadCounts(threads);
  }

  dispose(): void {
    this._treeView.dispose();
  }
}
