import * as vscode from "vscode";
import { FeatureDetector } from "./featureDetector";
import { serverClient } from "./serverClient";
import { StatusBar } from "./statusBar";
import { CommentManager } from "./commentManager";

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

  context.subscriptions.push(
    statusBar,
    featureDetector,
    commentManager,
    outputChannel,
  );

  // Initialize feature detection and connection
  const init = async () => {
    const featureId = await featureDetector.initialize();

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
  };

  // Listen for branch changes
  featureDetector.onDidChangeFeature(async (newFeatureId) => {
    outputChannel.appendLine(
      `Branch changed — new feature: ${newFeatureId ?? "none"}`,
    );
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
