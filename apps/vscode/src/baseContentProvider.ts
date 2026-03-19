import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Provides old-side file content for diff editors via a virtual document scheme.
 * URI format: local-review-base:/<relative-path>?ref=<branch>
 */
export class BaseContentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private _cache = new Map<string, string>();
  private _mergeBaseSha: string | null = null;
  private _workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this._workspaceRoot = workspaceRoot;
  }

  async resolveMergeBase(): Promise<string> {
    if (this._mergeBaseSha) return this._mergeBaseSha;
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["merge-base", "HEAD", "main"],
        { cwd: this._workspaceRoot },
      );
      this._mergeBaseSha = stdout.trim();
    } catch {
      // Fallback to "main" if merge-base fails (e.g., no common ancestor)
      this._mergeBaseSha = "main";
    }
    return this._mergeBaseSha;
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const relativePath = uri.path.startsWith("/")
      ? uri.path.slice(1)
      : uri.path;

    const cached = this._cache.get(relativePath);
    if (cached !== undefined) return cached;

    const ref = await this.resolveMergeBase();
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${ref}:${relativePath}`],
        { cwd: this._workspaceRoot, maxBuffer: 10 * 1024 * 1024 },
      );
      this._cache.set(relativePath, stdout);
      return stdout;
    } catch {
      // File doesn't exist at ref (new file) — return empty
      this._cache.set(relativePath, "");
      return "";
    }
  }

  private _buildUri(key: string): vscode.Uri {
    return vscode.Uri.parse(`${SCHEME_BASE}:/${key}`);
  }

  invalidate(path?: string): void {
    if (path) {
      const key = path.startsWith("/") ? path.slice(1) : path;
      if (this._cache.delete(key)) {
        this._onDidChange.fire(this._buildUri(key));
      }
    } else {
      const keys = [...this._cache.keys()];
      this._cache.clear();
      this._mergeBaseSha = null;
      for (const key of keys) {
        this._onDidChange.fire(this._buildUri(key));
      }
    }
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

/**
 * Trivial content provider that always returns empty string.
 * Used for the new-side URI of deleted files.
 */
export class EmptyContentProvider
  implements vscode.TextDocumentContentProvider
{
  provideTextDocumentContent(): string {
    return "";
  }
}

export const SCHEME_BASE = "local-review-base";
export const SCHEME_EMPTY = "local-review-empty";
