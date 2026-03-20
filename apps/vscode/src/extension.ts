import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { FeatureDetector } from "./featureDetector";
import {
  sessionStore,
  setWorkspaceName,
  setOnBeforeWrite,
  getSessionFilePath,
} from "./sessionStore";
import type { SessionThread } from "./sessionStore";
import { StatusBar } from "./statusBar";
import { CommentManager } from "./commentManager";
import { SessionWatcher } from "./sessionWatcher";
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
  const sessionWatcher = new SessionWatcher(outputChannel);

  // Wire file watcher suppression into sessionStore — every write suppresses the echo
  setOnBeforeWrite(() => sessionWatcher.suppressNextChange());

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
    sessionWatcher,
    diffPanelManager,
    threadsTreeView,
    outputChannel,
  );

  // Wire up comment creation/reply/resolve commands.
  commentManager.setupCommentHandlers(
    context,
    () => featureDetector.featureId,
    outputChannel,
  );

  let currentFeatureId: string | null = null;

  // Subscribe to file watcher events (replaces WS session-updated)
  context.subscriptions.push(
    sessionWatcher.onDidSessionChange((session) => {
      if (!currentFeatureId) return;
      const threads = session.threads ?? [];
      outputChannel.appendLine(
        `Session file changed: reconciling ${threads.length} threads for ${currentFeatureId}`,
      );
      commentManager.loadThreads(threads);
      statusBar.updateThreadCount(threads.length);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    }),
  );

  // Resolve workspace name from git repo root (handles worktrees).
  const resolveWorkspace = async () => {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: workspaceRoot },
      );
      const gitCommonDir = path.resolve(workspaceRoot, stdout.trim());
      const repoName = path.basename(path.dirname(gitCommonDir));
      setWorkspaceName(repoName);
      outputChannel.appendLine(`Workspace resolved: ${repoName}`);
    } catch {
      const fallback = path.basename(workspaceRoot);
      setWorkspaceName(fallback);
      outputChannel.appendLine(`Workspace fallback: ${fallback}`);
    }
  };

  const loadSession = async (featureId: string) => {
    try {
      const session = await sessionStore.getSession(featureId);
      if (!session) {
        commentManager.loadThreads([]);
        threadsTree.updateThreads([]);
        diffPanelManager.close();
        statusBar.setNoSession();
        outputChannel.appendLine("No review session found");
        return;
      }

      const threads = session.threads ?? [];
      const openThreads = threads.filter(
        (t: SessionThread) => t.status === "open",
      ).length;
      commentManager.loadThreads(threads);
      statusBar.setReady(threads.length);
      threadsTree.updateThreads(threads);
      outputChannel.appendLine(
        `Session loaded: ${threads.length} threads (${openThreads} open)`,
      );

      // Start watching the session file for external changes
      sessionWatcher.watch(getSessionFilePath(featureId));

      // Populate sidebar tree with changed files
      await diffPanelManager.populate(featureId);
      diffPanelManager.updateThreadCounts(threads);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(
        `Failed to load session for ${featureId}: ${msg}`,
      );
      void vscode.window.showErrorMessage(
        `Local Review: Failed to load review session — ${msg}`,
      );
    }
  };

  // Initialize feature detection
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
    await loadSession(featureId);
  };

  // Listen for branch changes
  featureDetector.onDidChangeFeature(async (newFeatureId) => {
    outputChannel.appendLine(
      `Branch changed — new feature: ${newFeatureId ?? "none"}`,
    );
    currentFeatureId = newFeatureId;
    sessionWatcher.unwatch();

    if (!newFeatureId) {
      commentManager.loadThreads([]);
      threadsTree.updateThreads([]);
      diffPanelManager.close();
      statusBar.setNoFeature();
      return;
    }

    await loadSession(newFeatureId);
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("local-review.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode.commands.registerCommand("local-review.startReview", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first.",
        );
        return;
      }

      const existing = await sessionStore.getSession(featureId);
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
        verdict: null as "approved" | "changes_requested" | null,
        threads: [] as SessionThread[],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      try {
        sessionStore.saveSession(featureId, session);
        commentManager.loadThreads([]);
        statusBar.setReady(0);
        sessionWatcher.watch(getSessionFilePath(featureId));
        currentFeatureId = featureId;
        await diffPanelManager.populate(featureId);
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
        `Request Changes: setting verdict for ${featureId}`,
      );

      try {
        await sessionStore.setVerdict(featureId, "changes_requested");
        void vscode.window.showInformationMessage(
          "Verdict saved. Run /resolve in your Claude session to process threads.",
        );
        outputChannel.appendLine("Verdict set to changes_requested");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Request Changes failed: ${msg}`);
        void vscode.window.showErrorMessage(`Failed to set verdict: ${msg}`);
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
      try {
        await diffPanelManager.open(featureId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`openDiff failed: ${msg}`);
        void vscode.window.showErrorMessage(
          `Local Review: Failed to open diff — ${msg}`,
        );
      }
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

    vscode.commands.registerCommand(
      "local-review.goToThread",
      async (filePath: string, line: number) => {
        await diffPanelManager.openFile({
          path: filePath,
          oldPath: filePath,
          newPath: filePath,
          status: "M",
        });
        setTimeout(() => {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const pos = new vscode.Position(Math.max(0, line - 1), 0);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter,
            );
          }
        }, 300);
      },
    ),

    vscode.commands.registerCommand("local-review.refreshDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) return;
      try {
        await diffPanelManager.refresh(featureId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`refreshDiff failed: ${msg}`);
      }
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
