import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execFileAsync = promisify(execFile);

export class FeatureDetector implements vscode.Disposable {
  private readonly _onDidChangeFeature = new vscode.EventEmitter<
    string | null
  >();
  readonly onDidChangeFeature = this._onDidChangeFeature.event;

  private _currentFeatureId: string | null = null;
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _workspaceRoot: string;

  get featureId(): string | null {
    return this._currentFeatureId;
  }

  get workspaceRoot(): string {
    return this._workspaceRoot;
  }

  constructor(workspaceRoot: string) {
    this._workspaceRoot = workspaceRoot;
  }

  async initialize(): Promise<string | null> {
    this._currentFeatureId = await this._detectFeatureId();
    await this._startWatching();
    return this._currentFeatureId;
  }

  private async _detectFeatureId(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        {
          cwd: this._workspaceRoot,
        },
      );
      const branch = stdout.trim();
      const match = branch.match(/^feature\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private async _startWatching(): Promise<void> {
    try {
      // Find the actual .git directory (handles worktrees where .git is a file)
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--git-dir"],
        {
          cwd: this._workspaceRoot,
        },
      );
      const gitDir = path.resolve(this._workspaceRoot, stdout.trim());
      const headPath = path.join(gitDir, "HEAD");

      // Watch .git/HEAD for branch changes
      this._watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          path.dirname(headPath),
          path.basename(headPath),
        ),
      );

      const onHeadChange = async () => {
        const newFeatureId = await this._detectFeatureId();
        if (newFeatureId !== this._currentFeatureId) {
          this._currentFeatureId = newFeatureId;
          this._onDidChangeFeature.fire(newFeatureId);
        }
      };

      this._watcher.onDidChange(onHeadChange);
      this._watcher.onDidCreate(onHeadChange);
    } catch {
      // If git dir detection fails, just skip watching
    }
  }

  dispose(): void {
    this._watcher?.dispose();
    this._onDidChangeFeature.dispose();
  }
}
