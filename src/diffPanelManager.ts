import * as vscode from "vscode";
import {
  BaseContentProvider,
  SCHEME_BASE,
  SCHEME_EMPTY,
} from "./baseContentProvider";
import {
  ChangedFilesTreeProvider,
  cycleMode,
  parseFileViewMode,
} from "./changedFilesTree";
import type { TreeNode } from "./changedFilesTree";
import { DiffStatus, parseDiffFileList } from "./diffParser";
import type { DiffFileEntry } from "./diffParser";
import { ReviewFileDecorationProvider } from "./fileDecorationProvider";
import { getLocalDiff } from "./gitDiff";
import type { SessionThread } from "./sessionStore";
import { getDefaultTargetBranch } from "./config";

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
  private _baseProvider: BaseContentProvider;
  private _treeProvider: ChangedFilesTreeProvider;
  private _decorationProvider: ReviewFileDecorationProvider;
  private _decorationDisposable: vscode.Disposable;
  private _workspaceRoot: string;
  private _outputChannel: vscode.OutputChannel;
  private _treeView: vscode.TreeView<TreeNode>;
  private _context: vscode.ExtensionContext;
  private _targetBranch: string | undefined;

  get treeProvider(): ChangedFilesTreeProvider {
    return this._treeProvider;
  }

  /** Look up a diff file entry by path (matches path, oldPath, or newPath) */
  getFileByPath(filePath: string): DiffFileRef | undefined {
    return this._files.find(
      (f) =>
        f.path === filePath || f.oldPath === filePath || f.newPath === filePath,
    );
  }

  constructor(
    workspaceRoot: string,
    baseProvider: BaseContentProvider,
    outputChannel: vscode.OutputChannel,
    context: vscode.ExtensionContext,
  ) {
    this._workspaceRoot = workspaceRoot;
    this._baseProvider = baseProvider;
    this._outputChannel = outputChannel;
    this._context = context;
    this._treeProvider = new ChangedFilesTreeProvider();
    this._decorationProvider = new ReviewFileDecorationProvider();
    this._decorationDisposable = vscode.window.registerFileDecorationProvider(
      this._decorationProvider,
    );

    // Restore persisted view mode
    const savedMode = parseFileViewMode(
      context.workspaceState.get<string>("fileViewMode"),
    );
    this._treeProvider.setMode(savedMode);
    void vscode.commands.executeCommand(
      "setContext",
      "resolvr.fileViewMode",
      savedMode,
    );

    this._treeView = vscode.window.createTreeView("resolvr.changedFiles", {
      treeDataProvider: this._treeProvider,
    });
  }

  /** Toggle view mode: flat ↔ compact-tree. */
  toggleViewMode(): void {
    const nextMode = cycleMode(this._treeProvider.mode);
    this._treeProvider.setMode(nextMode);

    void this._context.workspaceState.update("fileViewMode", nextMode);
    void vscode.commands.executeCommand(
      "setContext",
      "resolvr.fileViewMode",
      nextMode,
    );

    this._outputChannel.appendLine(`File view mode: ${nextMode}`);
  }

  /**
   * Populate the sidebar tree with changed files without opening a diff tab.
   * Used on activation so the activity bar shows file list immediately.
   */
  async populate(sessionId?: string, targetBranch?: string): Promise<void> {
    // Clear stale decorations before fetch to prevent leftover badges on early return
    this._decorationProvider.clear();

    try {
      const defaultTarget = targetBranch ?? getDefaultTargetBranch();
      this._targetBranch = defaultTarget;
      const diff = await getLocalDiff(
        this._workspaceRoot,
        sessionId,
        defaultTarget,
      );
      this._files = parseDiffFileList(diff.allDiff);

      this._treeProvider.setFiles(this._files);
      this._decorationProvider.setFiles(this._files);
      this._updateTitle();

      void vscode.commands.executeCommand(
        "setContext",
        "resolvr.hasDiffPanel",
        this._files.length > 0,
      );

      this._outputChannel.appendLine(
        `Diff tree populated${sessionId ? ` for ${sessionId}` : ""}: ${this._files.length} files`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._outputChannel.appendLine(`Failed to populate diff tree: ${msg}`);
      this._treeProvider.setFiles([]);
    }
  }

  async open(sessionId?: string, targetBranch?: string): Promise<void> {
    await this.populate(sessionId, targetBranch);

    if (this._files.length === 0) {
      void vscode.window.showInformationMessage(
        "No changes found between target branch and working tree.",
      );
      return;
    }

    const firstItem = this._treeProvider.getFirstFile();
    if (firstItem) {
      void this._treeView.reveal(firstItem, { focus: true });
      await this.openFile(firstItem);
    }
  }

  async openFile(file: DiffFileRef): Promise<void> {
    let oldUri: vscode.Uri;
    let newUri: vscode.Uri;

    switch (file.status) {
      case DiffStatus.Deleted:
        // Deleted file: old has content, new is empty
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = makeSchemeUri(SCHEME_EMPTY, file.oldPath);
        break;
      case DiffStatus.Added:
        // New file: old is empty, new is working tree
        oldUri = makeSchemeUri(SCHEME_EMPTY, file.newPath);
        newUri = vscode.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      case DiffStatus.Renamed:
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
      file.status === DiffStatus.Renamed
        ? `${file.oldPath} → ${file.newPath} (Review Diff)`
        : `${file.path} (Review Diff)`;

    await vscode.commands.executeCommand("vscode.diff", oldUri, newUri, title);
  }

  private _updateTitle(): void {
    this._treeView.title = `Changed Files (${this._files.length})`;
    this._treeView.description = this._targetBranch
      ? `vs ${this._targetBranch}`
      : undefined;
  }

  async refresh(sessionId?: string, targetBranch?: string): Promise<void> {
    this._baseProvider.invalidate();
    await this.populate(sessionId, targetBranch);
  }

  close(): void {
    if (this._files.length === 0) return;
    this._treeProvider.setFiles([]);
    this._decorationProvider.clear();
    this._files = [];
    void vscode.commands.executeCommand(
      "setContext",
      "resolvr.hasDiffPanel",
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
