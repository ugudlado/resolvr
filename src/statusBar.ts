import * as vscode from "vscode";

const enum StatusBarState {
  Ready = "ready",
  NoBranch = "no-branch",
}

export class StatusBar implements vscode.Disposable {
  private _item: vscode.StatusBarItem;
  private _state: StatusBarState = StatusBarState.NoBranch;
  private _threadCount = 0;
  private _openThreadCount = 0;

  constructor() {
    this._item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this._item.show();
    this._update();
  }

  setReady(threadCount: number, openCount?: number): void {
    this._state = StatusBarState.Ready;
    this._threadCount = threadCount;
    if (openCount !== undefined) {
      this._openThreadCount = openCount;
    }
    this._update();
  }

  setNoBranch(): void {
    this._state = StatusBarState.NoBranch;
    this._update();
  }

  updateThreadCount(count: number, openCount?: number): void {
    this._threadCount = count;
    if (openCount !== undefined) {
      this._openThreadCount = openCount;
    }
    if (this._state === StatusBarState.Ready) {
      this._update();
    }
  }

  private _update(): void {
    switch (this._state) {
      case StatusBarState.Ready:
        if (this._openThreadCount > 0) {
          this._item.text = `$(sparkle) Resolvr: ${this._openThreadCount} open · Resolve with AI`;
          this._item.tooltip =
            "Click to resolve open threads with your coding agent";
          this._item.command = "resolvr.resolveWithAI";
          this._item.backgroundColor = new vscode.ThemeColor(
            "statusBarItem.warningBackground",
          );
        } else if (this._threadCount > 0) {
          this._item.text = `$(check) Resolvr: ${this._threadCount} threads · All resolved`;
          this._item.tooltip = "All review threads resolved";
          this._item.command = "resolvr.refresh";
          this._item.backgroundColor = undefined;
        } else {
          this._item.text = "$(comment-discussion) Resolvr: No active threads";
          this._item.tooltip = "No review threads yet";
          this._item.command = "resolvr.refresh";
          this._item.backgroundColor = undefined;
        }
        break;
      case StatusBarState.NoBranch:
        this._item.text = "$(git-branch) Resolvr: No active branch";
        this._item.tooltip = "Switch to a non-default branch to activate";
        this._item.command = undefined;
        this._item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this._item.dispose();
  }
}
