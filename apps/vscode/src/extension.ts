import * as vscode from "vscode";
import { FeatureDetector } from "./featureDetector";
import { serverClient } from "./serverClient";
import type { SessionThread } from "./serverClient";
import { StatusBar } from "./statusBar";
import { CommentManager } from "./commentManager";
import { WsClient } from "./wsClient";

function getBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("local-review")
    .get<string>("serverUrl", "http://localhost:37003");
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Local Review");
  outputChannel.appendLine("Local Review extension activated");

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found — going dormant");
    return;
  }

  const statusBar = new StatusBar();
  const featureDetector = new FeatureDetector(workspaceRoot);
  const commentManager = new CommentManager(workspaceRoot, outputChannel);
  const wsClient = new WsClient(getBaseUrl(), outputChannel);

  context.subscriptions.push(
    statusBar,
    featureDetector,
    commentManager,
    wsClient,
    outputChannel,
  );

  // Wire up comment creation/reply/resolve commands.
  // getFeatureId() is evaluated at command invocation time so it always
  // reflects the current branch's feature.
  commentManager.setupCommentHandlers(
    context,
    () => featureDetector.featureId,
    outputChannel,
  );

  // Echo deduplication: after VS Code creates/updates a thread, mute incoming
  // WS updates for that thread for a short window to avoid flickering loops.
  const mutedThreadIds = new Set<string>();

  /** Mute a thread ID for 500 ms to suppress the echo of our own writes. */
  function muteThread(threadId: string): void {
    mutedThreadIds.add(threadId);
    setTimeout(() => mutedThreadIds.delete(threadId), 500);
  }

  // Expose muteThread so future command implementations (T-5, T-6) can call it
  // to suppress the WS echo after writing a thread.
  void muteThread; // referenced — prevents unused-variable warnings until consumed

  // Track current featureId so WS handler knows which session to reconcile.
  // Uses the featureDetector as the source of truth after initialization.
  let currentFeatureId: string | null = null;

  // Subscribe to session-updated events from the server.
  context.subscriptions.push(
    wsClient.on("review:session-updated", (data: unknown) => {
      if (!currentFeatureId) return;

      const payload = data as {
        fileName: string;
        session: { threads: SessionThread[] };
      };

      // Session file names are `<featureId>-code.json`
      const match = payload.fileName.match(/^(.+)-code\.json$/);
      if (!match || match[1] !== currentFeatureId) return;

      // Skip reconcile if any of our own writes are still in the mute window
      if (mutedThreadIds.size > 0) {
        outputChannel.appendLine(
          "WS session-updated: skipping (echo mute active)",
        );
        return;
      }

      const threads = payload.session.threads;
      outputChannel.appendLine(
        `WS session-updated: reconciling ${threads.length} threads for ${currentFeatureId}`,
      );
      commentManager.loadThreads(threads);
      statusBar.updateThreadCount(threads.length);
    }),
  );

  // Update status bar on connect/disconnect.
  context.subscriptions.push(
    wsClient.onDidConnect(() => {
      outputChannel.appendLine("WS connected — live sync active");
      // Only reflect connected state if we have an active session
      if (currentFeatureId) {
        statusBar.setConnected(commentManager.threadMapper.size);
      }
    }),
    wsClient.onDidDisconnect(() => {
      outputChannel.appendLine("WS disconnected");
      if (currentFeatureId) {
        statusBar.setDisconnected();
      }
    }),
  );

  // Initialize feature detection and connection
  const init = async () => {
    const featureId = await featureDetector.initialize();
    currentFeatureId = featureId;

    if (!featureId) {
      statusBar.setNoFeature();
      outputChannel.appendLine("No feature branch detected — dormant");
      return;
    }

    outputChannel.appendLine(`Feature detected: ${featureId}`);

    // Check server connection
    const connected = await serverClient.checkConnection();
    if (!connected) {
      statusBar.setDisconnected();
      outputChannel.appendLine("Server not reachable");
      return;
    }

    // Load session
    const session = await serverClient.getSession(featureId);
    if (!session) {
      statusBar.setNoSession();
      outputChannel.appendLine("No review session found");
      return;
    }

    const openThreads = session.threads.filter(
      (t) => t.status === "open",
    ).length;
    commentManager.loadThreads(session.threads);
    statusBar.setConnected(session.threads.length);
    outputChannel.appendLine(
      `Session loaded: ${session.threads.length} threads (${openThreads} open)`,
    );

    // Connect WebSocket for live updates (idempotent — reconnects if dropped)
    wsClient.connect();
  };

  // Listen for branch changes
  featureDetector.onDidChangeFeature(async (newFeatureId) => {
    outputChannel.appendLine(
      `Branch changed — new feature: ${newFeatureId ?? "none"}`,
    );
    currentFeatureId = newFeatureId;

    if (!newFeatureId) {
      commentManager.loadThreads([]);
      statusBar.setNoFeature();
      return;
    }
    // Re-initialize with new feature
    const connected = await serverClient.checkConnection();
    if (!connected) {
      commentManager.loadThreads([]);
      statusBar.setDisconnected();
      return;
    }
    const session = await serverClient.getSession(newFeatureId);
    if (!session) {
      commentManager.loadThreads([]);
      statusBar.setNoSession();
      return;
    }
    commentManager.loadThreads(session.threads);
    statusBar.setConnected(session.threads.length);
    outputChannel.appendLine(
      `Session loaded for ${newFeatureId}: ${session.threads.length} threads`,
    );
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("local-review.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode.commands.registerCommand("local-review.connect", () => {
      outputChannel.appendLine("Connect command invoked");
      void init();
    }),
    vscode.commands.registerCommand("local-review.disconnect", () => {
      outputChannel.appendLine("Disconnect command invoked");
      wsClient.disconnect();
      statusBar.setDisconnected();
    }),
    vscode.commands.registerCommand("local-review.startReview", () => {
      outputChannel.appendLine("Start Review command invoked");
      // TODO: Implement in T-4b
    }),
    vscode.commands.registerCommand("local-review.requestChanges", () => {
      outputChannel.appendLine("Request Changes command invoked");
      // TODO: Implement in T-6c
    }),
  );

  // Run initialization
  void init();
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
