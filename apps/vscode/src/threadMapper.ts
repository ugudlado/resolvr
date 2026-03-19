import * as vscode from "vscode";
import type { SessionThread } from "./serverClient";

export class ThreadMapper implements vscode.Disposable {
  private _sessionToVSCode = new Map<string, vscode.CommentThread>();
  private _vsCodeToSession = new Map<vscode.CommentThread, string>();

  register(sessionId: string, thread: vscode.CommentThread): void {
    this._sessionToVSCode.set(sessionId, thread);
    this._vsCodeToSession.set(thread, sessionId);
  }

  getVSCodeThread(sessionId: string): vscode.CommentThread | undefined {
    return this._sessionToVSCode.get(sessionId);
  }

  getSessionId(thread: vscode.CommentThread): string | undefined {
    return this._vsCodeToSession.get(thread);
  }

  disposeThread(sessionId: string): void {
    const thread = this._sessionToVSCode.get(sessionId);
    if (thread) {
      thread.dispose();
      this._vsCodeToSession.delete(thread);
      this._sessionToVSCode.delete(sessionId);
    }
  }

  /** Dispose all tracked threads and recreate from fresh data (dispose-and-recreate pattern). */
  reconcile(
    newThreads: SessionThread[],
    createThread: (thread: SessionThread) => vscode.CommentThread | null,
  ): void {
    // Dispose all existing
    for (const [, vsThread] of this._sessionToVSCode) {
      vsThread.dispose();
    }
    this._sessionToVSCode.clear();
    this._vsCodeToSession.clear();

    // Recreate from fresh data
    for (const sessionThread of newThreads) {
      const vsThread = createThread(sessionThread);
      if (vsThread) {
        this.register(sessionThread.id, vsThread);
      }
    }
  }

  clear(): void {
    for (const [, vsThread] of this._sessionToVSCode) {
      vsThread.dispose();
    }
    this._sessionToVSCode.clear();
    this._vsCodeToSession.clear();
  }

  get size(): number {
    return this._sessionToVSCode.size;
  }

  dispose(): void {
    this.clear();
  }
}
