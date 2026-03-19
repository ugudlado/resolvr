import * as vscode from "vscode";
import { createHash } from "crypto";
import type {
  SessionData,
  SessionThread,
  SessionMessage,
} from "./serverClient";
import { serverClient } from "./serverClient";
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

    // Enable the "+" gutter icon to allow commenting on any line
    this._controller.commentingRangeProvider = {
      provideCommentingRanges(document: vscode.TextDocument) {
        return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
      },
    };

    this._controller.options = {
      placeHolder: "Add a review comment...",
      prompt: "Type your review comment",
    };
  }

  loadThreads(threads: SessionThread[]): void {
    this._threadMapper.reconcile(threads, (t) => this._createVSCodeThread(t));
  }

  /**
   * Ensure a code review session exists for the given feature.
   * Creates one automatically if none exists (first-comment UX).
   */
  private async _ensureSession(featureId: string): Promise<void> {
    const existing = await serverClient.getSession(featureId);
    if (existing) return;

    const session: SessionData = {
      featureId,
      worktreePath: this._workspaceRoot,
      sourceBranch: `feature/${featureId}`,
      targetBranch: "main",
      verdict: null,
      threads: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    await serverClient.saveSession(featureId, session);
    this._outputChannel.appendLine(
      `Auto-created review session for ${featureId}`,
    );
  }

  /**
   * Register the comment action commands (create, reply, resolve, unresolve).
   * Must be called after the extension context is ready and a featureId is known.
   * The getFeatureId callback is used at command invocation time so it always
   * reflects the current branch's featureId.
   */
  setupCommentHandlers(
    context: vscode.ExtensionContext,
    getFeatureId: () => string | null,
    outputChannel: vscode.OutputChannel,
  ): void {
    context.subscriptions.push(
      // Create a new thread (user types in the "+" gutter inline box)
      vscode.commands.registerCommand(
        "local-review.createComment",
        async (reply: { text: string }, thread: vscode.CommentThread) => {
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode.window.showWarningMessage(
              "Local Review: No active feature branch.",
            );
            return;
          }
          if (!reply.text?.trim()) {
            return;
          }
          try {
            // Auto-create session on first comment
            await this._ensureSession(featureId);

            const sessionThread = await this._buildNewThread(
              thread,
              reply.text.trim(),
            );
            await serverClient.createThread(featureId, sessionThread);
            this._threadMapper.register(sessionThread.id, thread);

            // Update the VS Code thread with the saved comment
            thread.comments = [this._createComment(sessionThread.messages[0])];
            thread.collapsibleState =
              vscode.CommentThreadCollapsibleState.Expanded;

            outputChannel.appendLine(
              `Created thread ${sessionThread.id} on ${sessionThread.anchor.path}:${sessionThread.anchor.line}`,
            );
          } catch (err) {
            outputChannel.appendLine(`Failed to create thread: ${String(err)}`);
            void vscode.window.showErrorMessage(
              `Local Review: Failed to create comment — ${String(err)}`,
            );
          }
        },
      ),

      // Reply to an existing thread
      vscode.commands.registerCommand(
        "local-review.replyToComment",
        async (reply: { text: string }, thread: vscode.CommentThread) => {
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode.window.showWarningMessage(
              "Local Review: No active feature branch.",
            );
            return;
          }
          if (!reply.text?.trim()) {
            return;
          }
          const sessionId = this._threadMapper.getSessionId(thread);
          if (!sessionId) {
            outputChannel.appendLine(
              "replyToComment: thread not found in mapper — no session ID",
            );
            return;
          }
          const now = new Date().toISOString();
          const newMessage: SessionMessage = {
            id: crypto.randomUUID(),
            authorType: "human",
            author: "Reviewer",
            text: reply.text.trim(),
            createdAt: now,
          };
          try {
            await serverClient.updateThread(featureId, sessionId, {
              messages: [...this._getExistingMessages(thread), newMessage],
            });

            // Append the new comment to the VS Code thread
            thread.comments = [
              ...thread.comments,
              this._createComment(newMessage),
            ];

            outputChannel.appendLine(`Replied to thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(`Failed to reply: ${String(err)}`);
            void vscode.window.showErrorMessage(
              `Local Review: Failed to post reply — ${String(err)}`,
            );
          }
        },
      ),

      // Resolve a thread
      vscode.commands.registerCommand(
        "local-review.resolveThread",
        async (thread: vscode.CommentThread) => {
          const featureId = getFeatureId();
          if (!featureId) return;
          const sessionId = this._threadMapper.getSessionId(thread);
          if (!sessionId) return;
          try {
            await serverClient.updateThread(featureId, sessionId, {
              status: "resolved",
            });
            thread.state = 1; // CommentThreadState.Resolved
            thread.collapsibleState =
              vscode.CommentThreadCollapsibleState.Collapsed;
            outputChannel.appendLine(`Resolved thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(`Failed to resolve: ${String(err)}`);
            void vscode.window.showErrorMessage(
              `Local Review: Failed to resolve thread — ${String(err)}`,
            );
          }
        },
      ),

      // Re-open a resolved thread
      vscode.commands.registerCommand(
        "local-review.unresolveThread",
        async (thread: vscode.CommentThread) => {
          const featureId = getFeatureId();
          if (!featureId) return;
          const sessionId = this._threadMapper.getSessionId(thread);
          if (!sessionId) return;
          try {
            await serverClient.updateThread(featureId, sessionId, {
              status: "open",
            });
            thread.state = 0; // CommentThreadState.Unresolved
            thread.collapsibleState =
              vscode.CommentThreadCollapsibleState.Expanded;
            outputChannel.appendLine(`Re-opened thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(`Failed to re-open: ${String(err)}`);
            void vscode.window.showErrorMessage(
              `Local Review: Failed to re-open thread — ${String(err)}`,
            );
          }
        },
      ),
    );
  }

  private async _buildNewThread(
    vsThread: vscode.CommentThread,
    text: string,
  ): Promise<SessionThread> {
    const relativePath = vscode.workspace.asRelativePath(vsThread.uri);
    // range may be undefined in older VS Code API typings — default to line 0
    const range = vsThread.range ?? new vscode.Range(0, 0, 0, 0);
    const line = range.start.line + 1; // 0-based → 1-based
    const lineEnd = range.end.line + 1;

    const document = await vscode.workspace.openTextDocument(vsThread.uri);
    const lineContent = document.lineAt(range.start.line).text;
    const hash = createHash("sha256")
      .update(lineContent)
      .digest("hex")
      .slice(0, 8);

    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const threadId = crypto.randomUUID();

    const message: SessionMessage = {
      id: messageId,
      authorType: "human",
      author: "Reviewer",
      text,
      createdAt: now,
    };

    const sessionThread: SessionThread = {
      id: threadId,
      anchor: {
        type: "diff-line",
        hash,
        path: relativePath,
        preview: lineContent.slice(0, 120),
        line,
        lineEnd,
        side: "new",
      },
      status: "open",
      severity: "improvement",
      messages: [message],
      lastUpdatedAt: now,
    };

    return sessionThread;
  }

  /**
   * Extract the text content of existing comments on a VS Code thread so we
   * can append a new message when replying.  We reconstruct minimal
   * SessionMessage objects from the Comment objects already displayed.
   */
  private _getExistingMessages(thread: vscode.CommentThread): SessionMessage[] {
    return thread.comments.map((c): SessionMessage => {
      const body =
        c.body instanceof vscode.MarkdownString ? c.body.value : String(c.body);
      return {
        id: crypto.randomUUID(),
        authorType: "human",
        author: c.author.name,
        text: body,
        createdAt: new Date().toISOString(),
      };
    });
  }

  private _createVSCodeThread(
    sessionThread: SessionThread,
  ): vscode.CommentThread | null {
    // Threads may be in anchor format (from VS Code) or flat format (from browser).
    // Normalize to get path, line, lineEnd, side.
    const anchor = sessionThread.anchor;
    const flat = sessionThread as unknown as Record<string, unknown>;
    const threadPath =
      anchor?.path ?? (flat.filePath as string | undefined) ?? "";
    const threadLine = anchor?.line ?? (flat.line as number | undefined) ?? 1;
    const threadLineEnd =
      anchor?.lineEnd ?? (flat.lineEnd as number | undefined);
    const threadSide =
      anchor?.side ?? (flat.side as "old" | "new" | undefined) ?? "new";

    if (!threadPath) {
      this._outputChannel.appendLine(
        `Skipping thread ${sessionThread.id} — no file path`,
      );
      return null;
    }

    // Skip old-side anchors — can't render in working tree
    if (threadSide === "old") {
      this._outputChannel.appendLine(
        `Skipping old-side thread ${sessionThread.id} on ${threadPath}:${threadLine}`,
      );
      return null;
    }

    const filePath = vscode.Uri.file(`${this._workspaceRoot}/${threadPath}`);

    // 1-based session lines → 0-based VS Code range
    const startLine = threadLine - 1;
    const endLine = (threadLineEnd ?? threadLine) - 1;
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

    // Resolved threads are collapsed UNLESS the last message is from an agent
    // (user needs to read the agent's response before deciding next action)
    const lastMsg = sessionThread.messages[sessionThread.messages.length - 1];
    const hasAgentReply =
      lastMsg?.authorType === "agent" && sessionThread.status === "resolved";

    thread.collapsibleState =
      sessionThread.status === "open" || hasAgentReply
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
