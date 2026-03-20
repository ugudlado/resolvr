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
import { ReviewFileDecorationProvider } from "./fileDecorationProvider";
import { getLocalDiff } from "./gitDiff";
import type { SessionThread } from "./sessionStore";

/** Minimal file identity needed for opening a diff — no stats required */
type DiffFileRef = Pick<
  DiffFileEntry,
  "path" | "oldPath" | "newPath" | "status"
>;

function makeSchemeUri(scheme: string, relativePath: string): vscode.Uri {
  return vscode.Uri.from({ scheme, path: "/" + relativePath });
}

export class DiffPanelManager implements vscode.Disposable {
  private _files: DiffFileEntry[] = [];
  private _viewedFiles = new Set<string>();
  private _baseProvider: BaseContentProvider;
  private _treeProvider: ChangedFilesTreeProvider;
  private _decorationProvider: ReviewFileDecorationProvider;
  private _decorationDisposable: vscode.Disposable;
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
    this._decorationProvider = new ReviewFileDecorationProvider();
    this._decorationDisposable = vscode.window.registerFileDecorationProvider(
      this._decorationProvider,
    );

    this._treeView = vscode.window.createTreeView("localReview.changedFiles", {
      treeDataProvider: this._treeProvider,
    });
  }

  /**
   * Populate the sidebar tree with changed files without opening a diff tab.
   * Used on activation so the activity bar shows file list immediately.
   */
  async populate(featureId: string): Promise<void> {
    // Clear stale decorations before fetch to prevent leftover badges on early return
    this._decorationProvider.clear();

    try {
      const diff = await getLocalDiff(this._workspaceRoot, featureId);
      this._files = parseDiffFileList(diff.allDiff);

      this._treeProvider.setFiles(this._files);
      this._decorationProvider.setFiles(this._files);
      this._updateTitle();

      void vscode.commands.executeCommand(
        "setContext",
        "local-review.hasDiffPanel",
        this._files.length > 0,
      );

      this._outputChannel.appendLine(
        `Diff tree populated for ${featureId}: ${this._files.length} files`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._outputChannel.appendLine(`Failed to populate diff tree: ${msg}`);
      this._treeProvider.setFiles([]);
    }
  }

  async open(featureId: string): Promise<void> {
    await this.populate(featureId);

    if (this._files.length === 0) {
      void vscode.window.showInformationMessage(
        "No changes found between main and working tree.",
      );
      return;
    }

    const firstItem = this._treeProvider.getFirstFile();
    if (firstItem) {
      void this._treeView.reveal(firstItem, { focus: true });
    }

    await this.openFile(this._files[0]);
  }

  async openFile(file: DiffFileRef): Promise<void> {
    let oldUri: vscode.Uri;
    let newUri: vscode.Uri;

    switch (file.status) {
      case "D":
        // Deleted file: old has content, new is empty
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = makeSchemeUri(SCHEME_EMPTY, file.oldPath);
        break;
      case "A":
        // New file: old is empty, new is working tree
        oldUri = makeSchemeUri(SCHEME_EMPTY, file.newPath);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      case "R":
        // Renamed: old path for base, new path for working tree
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      default:
        // Modified: base content vs working tree
        oldUri = makeSchemeUri(SCHEME_BASE, file.path);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.path}`);
    }

    const title =
      file.status === "R"
        ? `${file.oldPath} → ${file.newPath} (Review Diff)`
        : `${file.path} (Review Diff)`;

    await vscode.commands.executeCommand("vscode.diff", oldUri, newUri, title);

    // Track viewed files for progress indicator
    this._viewedFiles.add(file.path);
    this._updateTitle();
  }

  private _updateTitle(): void {
    if (this._files.length === 0) return;
    const viewed = this._viewedFiles.size;
    const total = this._files.length;
    this._treeView.title =
      viewed > 0
        ? `Changed Files (${viewed}/${total} viewed)`
        : `Changed Files (${total})`;
  }

  async refresh(featureId: string): Promise<void> {
    this._baseProvider.invalidate();
    await this.populate(featureId);
  }

  close(): void {
    if (this._files.length === 0) return;
    this._treeProvider.setFiles([]);
    this._decorationProvider.clear();
    this._files = [];
    this._viewedFiles.clear();
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
    this._decorationProvider.dispose();
    this._decorationDisposable.dispose();
  }
}
