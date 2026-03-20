import * as vscode from "vscode";

export class StatusBar implements vscode.Disposable {
  private _item: vscode.StatusBarItem;
  private _state: "ready" | "no-feature" | "no-session" = "no-feature";
  private _threadCount = 0;

  constructor() {
    this._item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this._item.show();
    this._update();
  }

  setReady(threadCount: number): void {
    this._state = "ready";
    this._threadCount = threadCount;
    this._update();
  }

  setNoFeature(): void {
    this._state = "no-feature";
    this._update();
  }

  setNoSession(): void {
    this._state = "no-session";
    this._item.command = "local-review.startReview";
    this._update();
  }

  updateThreadCount(count: number): void {
    this._threadCount = count;
    if (this._state === "ready") {
      this._update();
    }
  }

  private _update(): void {
    switch (this._state) {
      case "ready":
        this._item.text = `$(comment-discussion) Local Review: ${this._threadCount} threads`;
        this._item.tooltip = "Local Review";
        this._item.command = "local-review.refresh";
        this._item.backgroundColor = undefined;
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
