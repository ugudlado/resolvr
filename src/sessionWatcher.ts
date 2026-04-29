import * as vscode from "vscode";
import * as fs from "fs";
import type { SessionData } from "./sessionStore";

/**
 * Watches a session file for external changes and emits events with parsed data.
 * Replaces the WebSocket client with a file-system watcher.
 */
export class SessionWatcher implements vscode.Disposable {
  private _watcher: vscode.FileSystemWatcher | null = null;
  private _currentPath: string | null = null;
  private _suppressUntil = 0;
  private _outputChannel: vscode.OutputChannel;
  private _lastEmittedMtimeMs = 0;

  private readonly _onDidSessionChange = new vscode.EventEmitter<SessionData>();
  readonly onDidSessionChange = this._onDidSessionChange.event;

  constructor(outputChannel: vscode.OutputChannel) {
    this._outputChannel = outputChannel;
  }

  /**
   * Call before writing to suppress the file watcher echo.
   * Sets a 500ms suppression window.
   */
  suppressNextChange(): void {
    this._suppressUntil = Date.now() + 500;
  }

  /** Start watching a specific session file. */
  watch(sessionFilePath: string): void {
    this.unwatch();
    this._currentPath = sessionFilePath;
    try {
      this._lastEmittedMtimeMs = fs.statSync(sessionFilePath).mtimeMs;
    } catch {
      this._lastEmittedMtimeMs = 0;
    }

    // Watch the specific file using a glob pattern
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(sessionFilePath).with({
        path: vscode.Uri.file(sessionFilePath)
          .path.split("/")
          .slice(0, -1)
          .join("/"),
      }),
      vscode.Uri.file(sessionFilePath).path.split("/").pop()!,
    );
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const handleChange = (source: string) => {
      if (Date.now() < this._suppressUntil) {
        // Advance the mtime baseline so the polling fallback doesn't
        // re-fire on this self-write after the suppression window expires.
        try {
          if (this._currentPath) {
            this._lastEmittedMtimeMs = fs.statSync(this._currentPath).mtimeMs;
          }
        } catch {
          // ignore — file may have been replaced mid-rename
        }
        this._outputChannel.appendLine(
          `Session watcher: suppressed self-write (${source})`,
        );
        return;
      }
      this._readAndEmit(source);
    };

    this._watcher.onDidChange(() => handleChange("fs-watcher:change"));
    this._watcher.onDidCreate(() => handleChange("fs-watcher:create"));

    // Polling fallback: VS Code's FileSystemWatcher misses some atomic-rename
    // writes (especially on macOS), so we also poll mtime every second.
    fs.watchFile(sessionFilePath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs) return;
      if (curr.mtimeMs <= this._lastEmittedMtimeMs) return;
      handleChange("poll");
    });

    this._outputChannel.appendLine(
      `Session watcher: watching ${sessionFilePath}`,
    );
  }

  /** Stop watching the current file. */
  unwatch(): void {
    if (this._watcher) {
      this._watcher.dispose();
      this._watcher = null;
    }
    if (this._currentPath) {
      fs.unwatchFile(this._currentPath);
    }
    this._currentPath = null;
    this._lastEmittedMtimeMs = 0;
  }

  private _readAndEmit(source = "unknown"): void {
    if (!this._currentPath) return;
    try {
      const stat = fs.statSync(this._currentPath);
      const raw = fs.readFileSync(this._currentPath, "utf-8");
      const session = JSON.parse(raw) as SessionData;
      if (!Array.isArray(session.threads)) {
        this._outputChannel.appendLine(
          "Session watcher: parsed session has no threads array — ignoring",
        );
        return;
      }
      this._lastEmittedMtimeMs = stat.mtimeMs;
      this._outputChannel.appendLine(
        `Session watcher: external change detected via ${source} — ${session.threads.length} threads`,
      );
      this._onDidSessionChange.fire(session);
    } catch (err) {
      this._outputChannel.appendLine(
        `Session watcher: failed to read — ${String(err)}`,
      );
      void vscode.window.showWarningMessage(
        "Resolvr: Session file could not be read. Your view may be out of date. Try refreshing.",
      );
    }
  }

  dispose(): void {
    this.unwatch();
    this._onDidSessionChange.dispose();
  }
}
