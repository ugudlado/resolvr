import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { FeatureDetector } from "./featureDetector";
import { serverClient, setWorkspaceName, getBaseUrl } from "./serverClient";
import type { SessionThread } from "./serverClient";
import { StatusBar } from "./statusBar";
import { CommentManager } from "./commentManager";
import { WsClient } from "./wsClient";
import {
  BaseContentProvider,
  EmptyContentProvider,
  SCHEME_BASE,
  SCHEME_EMPTY,
} from "./baseContentProvider";
import { DiffPanelManager } from "./diffPanelManager";
import { ThreadsTreeProvider } from "./threadsTree";

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Local Review");
  outputChannel.appendLine("Local Review extension activated");

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found — going dormant");
    return;
  }

  // CRITICAL: Register content providers BEFORE CommentManager.
  // CommentManager._buildNewThread calls openTextDocument on virtual URIs,
  // which requires the provider to already be registered.
  const baseProvider = new BaseContentProvider(workspaceRoot);
  const emptyProvider = new EmptyContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME_BASE,
      baseProvider,
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME_EMPTY,
      emptyProvider,
    ),
    baseProvider,
  );

  const statusBar = new StatusBar();
  const featureDetector = new FeatureDetector(workspaceRoot);
  const commentManager = new CommentManager(workspaceRoot, outputChannel);
  const wsClient = new WsClient(getBaseUrl(), outputChannel);
  const diffPanelManager = new DiffPanelManager(
    workspaceRoot,
    baseProvider,
    outputChannel,
  );

  // Threads tree view — grouped by status (below Changed Files)
  const threadsTree = new ThreadsTreeProvider();
  const threadsTreeView = vscode.window.createTreeView("localReview.threads", {
    treeDataProvider: threadsTree,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    statusBar,
    featureDetector,
    commentManager,
    wsClient,
    diffPanelManager,
    threadsTreeView,
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

      const threads = payload.session?.threads ?? [];
      outputChannel.appendLine(
        `WS session-updated: reconciling ${threads.length} threads for ${currentFeatureId}`,
      );
      commentManager.loadThreads(threads);
      statusBar.updateThreadCount(threads.length);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    }),

    // Resolver progress events — update status bar during resolve runs
    wsClient.on("review:resolve-started", (data: unknown) => {
      const payload = data as { featureId: string; threadCount: number };
      if (payload.featureId !== currentFeatureId) return;
      statusBar.setResolving(0, payload.threadCount);
    }),

    wsClient.on("review:resolve-completed", (data: unknown) => {
      const payload = data as {
        featureId: string;
        resolved: number;
        clarifications: number;
      };
      if (payload.featureId !== currentFeatureId) return;
      statusBar.setResolveComplete(payload.resolved);
      outputChannel.appendLine(
        `Resolver complete (via WS): ${payload.resolved} resolved`,
      );
    }),

    wsClient.on("review:resolve-failed", (data: unknown) => {
      const payload = data as { featureId: string; error: string };
      if (payload.featureId !== currentFeatureId) return;
      statusBar.setResolveFailed(payload.error);
      outputChannel.appendLine(`Resolver failed (via WS): ${payload.error}`);
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

  // Resolve workspace name from git repo root (handles worktrees).
  // git-common-dir points to the main repo's .git even in a worktree.
  const resolveWorkspace = async () => {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: workspaceRoot },
      );
      // git-common-dir returns e.g. "/Users/.../code/review/.git"
      const gitCommonDir = path.resolve(workspaceRoot, stdout.trim());
      const repoName = path.basename(path.dirname(gitCommonDir));
      setWorkspaceName(repoName);
      outputChannel.appendLine(`Workspace resolved: ${repoName}`);
    } catch {
      // Fallback to directory name
      const fallback = path.basename(workspaceRoot);
      setWorkspaceName(fallback);
      outputChannel.appendLine(`Workspace fallback: ${fallback}`);
    }
  };

  // Initialize feature detection and connection
  const init = async () => {
    await resolveWorkspace();
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

    const threads = session.threads ?? [];
    const openThreads = threads.filter((t) => t.status === "open").length;
    commentManager.loadThreads(threads);
    statusBar.setConnected(threads.length);
    threadsTree.updateThreads(threads);
    outputChannel.appendLine(
      `Session loaded: ${session.threads.length} threads (${openThreads} open)`,
    );

    // Populate sidebar tree with changed files (without opening a diff tab)
    await diffPanelManager.populate(featureId);
    diffPanelManager.updateThreadCounts(threads);

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
      threadsTree.updateThreads([]);
      diffPanelManager.close();
      statusBar.setNoFeature();
      return;
    }
    // Re-initialize with new feature
    const connected = await serverClient.checkConnection();
    if (!connected) {
      commentManager.loadThreads([]);
      threadsTree.updateThreads([]);
      diffPanelManager.close();
      statusBar.setDisconnected();
      return;
    }
    const session = await serverClient.getSession(newFeatureId);
    if (!session) {
      commentManager.loadThreads([]);
      threadsTree.updateThreads([]);
      diffPanelManager.close();
      statusBar.setNoSession();
      return;
    }
    const threads = session.threads ?? [];
    commentManager.loadThreads(threads);
    threadsTree.updateThreads(threads);
    statusBar.setConnected(threads.length);

    // Populate sidebar tree for new feature
    await diffPanelManager.populate(newFeatureId);
    diffPanelManager.updateThreadCounts(threads);

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
    vscode.commands.registerCommand("local-review.startReview", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first.",
        );
        return;
      }

      const existing = await serverClient.getSession(featureId);
      if (existing) {
        void vscode.window.showInformationMessage(
          "Review session already exists for this feature.",
        );
        return;
      }

      outputChannel.appendLine(`Creating new review session for ${featureId}`);
      const branch = `feature/${featureId}`;
      const session = {
        featureId,
        worktreePath: workspaceRoot,
        sourceBranch: branch,
        targetBranch: "main",
        verdict: null,
        threads: [] as SessionThread[],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      try {
        await serverClient.saveSession(featureId, session);
        commentManager.loadThreads([]);
        statusBar.setConnected(0);
        wsClient.connect();
        currentFeatureId = featureId;
        outputChannel.appendLine("Review session created");
        void vscode.window.showInformationMessage(
          `Review session created for ${featureId}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to create session: ${msg}`);
        void vscode.window.showErrorMessage(
          `Failed to create review session: ${msg}`,
        );
      }
    }),
    vscode.commands.registerCommand("local-review.requestChanges", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode.window.showWarningMessage("No active feature.");
        return;
      }

      outputChannel.appendLine(
        `Request Changes: setting verdict + triggering resolver for ${featureId}`,
      );

      try {
        // Set verdict
        await serverClient.setVerdict(featureId, "changes_requested");

        // Trigger resolver
        statusBar.setResolving(0, 0);

        const result = await serverClient.triggerResolve(featureId, "code");

        if (result.ok) {
          const resolved = result.resolved ?? 0;
          const clarifications = result.clarifications ?? 0;
          statusBar.setResolveComplete(resolved);
          outputChannel.appendLine(
            `Resolver complete: ${resolved} resolved, ${clarifications} need clarification`,
          );
        } else {
          statusBar.setResolveFailed(result.error ?? "Unknown error");
          outputChannel.appendLine(
            `Resolver failed: ${result.error ?? "Unknown error"}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        statusBar.setResolveFailed(msg);
        outputChannel.appendLine(`Request Changes failed: ${msg}`);
      }
    }),

    // Diff panel commands
    vscode.commands.registerCommand("local-review.openDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first.",
        );
        return;
      }
      const connected = await serverClient.checkConnection();
      if (!connected) {
        void vscode.window.showErrorMessage(
          "Local Review server is not reachable.",
        );
        return;
      }
      await diffPanelManager.open(featureId);
    }),

    vscode.commands.registerCommand(
      "local-review.openDiffFile",
      async (file: unknown) => {
        if (file && typeof file === "object" && "path" in file) {
          await diffPanelManager.openFile(
            file as {
              path: string;
              oldPath: string;
              newPath: string;
              status: "A" | "M" | "D" | "R";
            },
          );
        }
      },
    ),

    vscode.commands.registerCommand("local-review.refreshDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) return;
      await diffPanelManager.refresh(featureId);
    }),

    vscode.commands.registerCommand("local-review.closeDiff", () => {
      diffPanelManager.close();
    }),
  );

  // Run initialization
  void init();
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
