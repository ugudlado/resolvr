import * as vscode from "vscode";

export class StatusBar implements vscode.Disposable {
  private _item: vscode.StatusBarItem;
  private _state: "ready" | "no-feature" | "no-session" = "no-feature";
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

  setNoFeature(): void {
    this._state = "no-feature";
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
          this._item.text = `$(sparkle) Local Review: ${this._openThreadCount} open · Resolve with AI`;
          this._item.tooltip =
            "Click to resolve open threads with your coding agent";
          this._item.command = "local-review.resolveWithAI";
          this._item.backgroundColor = new vscode.ThemeColor(
            "statusBarItem.warningBackground",
          );
        } else if (this._threadCount > 0) {
          this._item.text = `$(check) Local Review: ${this._threadCount} threads · All resolved`;
          this._item.tooltip = "All review threads resolved";
          this._item.command = "local-review.refresh";
          this._item.backgroundColor = undefined;
        } else {
          this._item.text = "$(comment-discussion) Local Review";
          this._item.tooltip = "No review threads yet";
          this._item.command = "local-review.refresh";
          this._item.backgroundColor = undefined;
        }
        break;
      case "no-feature":
        this._item.text = "$(git-branch) Local Review: No active feature";
        this._item.tooltip = "Switch to a feature/* branch to activate";
        this._item.command = undefined;
        this._item.backgroundColor = undefined;
        break;
      case "no-session":
        this._item.text = "$(add) Local Review: Start Review";
        this._item.tooltip = "Click to create a new review session";
        this._item.command = "local-review.startReview";
        this._item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this._item.dispose();
  }
}
