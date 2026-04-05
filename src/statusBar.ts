import * as vscode from "vscode";

export class StatusBar implements vscode.Disposable {
  private _item: vscode.StatusBarItem;
  private _state: "ready" | "no-branch" | "no-session" = "no-branch";
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
    this._state = "ready";
    this._threadCount = threadCount;
    if (openCount !== undefined) {
      this._openThreadCount = openCount;
    }
    this._update();
  }

  setNoBranch(): void {
    this._state = "no-branch";
    this._update();
  }

  setNoSession(): void {
    this._state = "no-session";
    this._update();
  }

  updateThreadCount(count: number, openCount?: number): void {
    this._threadCount = count;
    if (openCount !== undefined) {
      this._openThreadCount = openCount;
    }
    if (this._state === "ready") {
      this._update();
    }
  }

  private _update(): void {
    switch (this._state) {
      case "ready":
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
          this._item.text = "$(comment-discussion) Resolvr";
          this._item.tooltip = "No review threads yet";
          this._item.command = "resolvr.refresh";
          this._item.backgroundColor = undefined;
        }
        break;
      case "no-branch":
        this._item.text = "$(git-branch) Resolvr: No active branch";
        this._item.tooltip = "Switch to a non-default branch to activate";
        this._item.command = undefined;
        this._item.backgroundColor = undefined;
        break;
      case "no-session":
        this._item.text = "$(add) Resolvr: Start Review";
        this._item.tooltip = "Click to create a new review session";
        this._item.command = "resolvr.startReview";
        this._item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this._item.dispose();
  }
}
