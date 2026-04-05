import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execFileAsync = promisify(execFile);

const DEFAULT_BRANCHES = new Set(["main", "master", "HEAD"]);

export class BranchDetector implements vscode.Disposable {
  private readonly _onDidChangeBranch = new vscode.EventEmitter<
    string | null
  >();
  readonly onDidChangeBranch = this._onDidChangeBranch.event;

  private _currentSessionId: string | null = null;
  private _currentBranchName: string | null = null;
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _workspaceRoot: string;

  /** Sanitized branch name safe for use as session key / filename. */
  get sessionId(): string | null {
    return this._currentSessionId;
  }

  /** Raw git branch name (e.g. "fix/auth-bug"). */
  get branchName(): string | null {
    return this._currentBranchName;
  }

  get workspaceRoot(): string {
    return this._workspaceRoot;
  }

  constructor(workspaceRoot: string) {
    this._workspaceRoot = workspaceRoot;
  }

  async initialize(): Promise<string | null> {
    await this._detect();
    await this._startWatching();
    return this._currentSessionId;
  }

  private async _detect(): Promise<void> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        {
          cwd: this._workspaceRoot,
        },
      );
      const branch = stdout.trim();
      if (DEFAULT_BRANCHES.has(branch)) {
        this._currentSessionId = null;
        this._currentBranchName = null;
        return;
      }
      this._currentBranchName = branch;
      this._currentSessionId = branch.replace(/\//g, "--");
    } catch {
      this._currentSessionId = null;
      this._currentBranchName = null;
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
        const prevId = this._currentSessionId;
        await this._detect();
        if (this._currentSessionId !== prevId) {
          this._onDidChangeBranch.fire(this._currentSessionId);
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
    this._onDidChangeBranch.dispose();
  }
}
