import * as vscode from "vscode";
import type { SessionThread, SessionMessage } from "./serverClient";
import { ThreadMapper } from "./threadMapper";

export class CommentManager implements vscode.Disposable {
  private _controller: vscode.CommentController;
  private _threadMapper: ThreadMapper;
  private _workspaceRoot: string;
  private _outputChannel: vscode.OutputChannel;

  get threadMapper(): ThreadMapper {
    return this._threadMapper;
  }

  constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel) {
    this._workspaceRoot = workspaceRoot;
    this._outputChannel = outputChannel;
    this._threadMapper = new ThreadMapper();
    this._controller = vscode.comments.createCommentController(
      "local-review",
      "Local Review",
    );
    // Will be enhanced in T-5 with commentingRangeProvider
  }

  loadThreads(threads: SessionThread[]): void {
    this._threadMapper.reconcile(threads, (t) => this._createVSCodeThread(t));
  }

  private _createVSCodeThread(
    sessionThread: SessionThread,
  ): vscode.CommentThread | null {
    // Skip old-side anchors — can't render in working tree
    if (sessionThread.anchor.side === "old") {
      this._outputChannel.appendLine(
        `Skipping old-side thread ${sessionThread.id} on ${sessionThread.anchor.path}:${sessionThread.anchor.line}`,
      );
      return null;
    }

    const filePath = vscode.Uri.file(
      `${this._workspaceRoot}/${sessionThread.anchor.path}`,
    );

    // 1-based session lines → 0-based VS Code range
    const startLine = sessionThread.anchor.line - 1;
    const endLine =
      (sessionThread.anchor.lineEnd ?? sessionThread.anchor.line) - 1;
    const range = new vscode.Range(startLine, 0, endLine, 0);

    const comments = sessionThread.messages.map((msg) =>
      this._createComment(msg),
    );

    const thread = this._controller.createCommentThread(
      filePath,
      range,
      comments,
    );

    // Set thread label with severity
    thread.label = sessionThread.severity
      ? `[${sessionThread.severity}]`
      : undefined;

    // Resolved threads are collapsed, open threads expanded
    thread.collapsibleState =
      sessionThread.status === "open"
        ? vscode.CommentThreadCollapsibleState.Expanded
        : vscode.CommentThreadCollapsibleState.Collapsed;

    // Mark resolved threads as resolved in VS Code
    // 0 = Unresolved, 1 = Resolved (CommentThreadState available since VS Code 1.88)
    thread.state =
      sessionThread.status === "resolved"
        ? 1 // CommentThreadState.Resolved
        : 0; // CommentThreadState.Unresolved

    return thread;
  }

  private _createComment(msg: SessionMessage): vscode.Comment {
    return {
      body: new vscode.MarkdownString(msg.text),
      mode: vscode.CommentMode.Preview,
      author: {
        name: msg.authorType === "agent" ? `🤖 ${msg.author}` : msg.author,
      },
      timestamp: new Date(msg.createdAt),
    };
  }

  dispose(): void {
    this._threadMapper.dispose();
    this._controller.dispose();
  }
}
