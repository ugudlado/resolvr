import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { BranchDetector } from "./branchDetector";
import {
  sessionStore,
  setWorkspaceRoot,
  setWorkspaceName,
  setOnBeforeWrite,
  getSessionFilePath,
} from "./sessionStore";
import type { SessionThread } from "./sessionStore";
import { SkillGenerator } from "./skillGenerator";
import { resolveInExistingTerminal, resolveWithNewAgent } from "./agentInvoker";
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
import { DiffStatus } from "./diffParser";
import { ThreadsTreeProvider } from "./threadsTree";

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Resolvr");
  outputChannel.appendLine("Resolvr extension activated");

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
  const branchDetector = new BranchDetector(workspaceRoot);
  const commentManager = new CommentManager(workspaceRoot, outputChannel);
  const sessionWatcher = new SessionWatcher(outputChannel);

  // Wire file watcher suppression into sessionStore — every write suppresses the echo
  setOnBeforeWrite(() => sessionWatcher.suppressNextChange());

  const diffPanelManager = new DiffPanelManager(
    workspaceRoot,
    baseProvider,
    outputChannel,
    context,
  );

  const skillGenerator = new SkillGenerator(workspaceRoot);

  // Threads tree view — grouped by status (below Changed Files)
  const threadsTree = new ThreadsTreeProvider();
  const threadsTreeView = vscode.window.createTreeView("resolvr.threads", {
    treeDataProvider: threadsTree,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    statusBar,
    branchDetector,
    commentManager,
    sessionWatcher,
    diffPanelManager,
    threadsTreeView,
    outputChannel,
  );

  // Wire up comment creation/reply/resolve commands.
  commentManager.setupCommentHandlers(
    context,
    () => branchDetector.sessionId,
    outputChannel,
    () => branchDetector.branchName,
  );

  let currentSessionId: string | null = null;

  // Subscribe to file watcher events (replaces WS session-updated)
  context.subscriptions.push(
    sessionWatcher.onDidSessionChange((session) => {
      if (!currentSessionId) return;
      const threads = session.threads ?? [];
      outputChannel.appendLine(
        `Session file changed: reconciling ${threads.length} threads for ${currentSessionId}`,
      );
      commentManager.loadThreads(threads);
      const openCount = threads.filter(
        (t: SessionThread) => t.status === "open",
      ).length;
      statusBar.updateThreadCount(threads.length, openCount);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    }),
  );

  // Refresh threads tree after in-process status changes (resolve, wontfix, etc.)
  // File watcher is suppressed for self-writes, so we refresh manually here.
  context.subscriptions.push(
    commentManager.onDidUpdateThread(async (sessionId) => {
      const session = await sessionStore.getSession(sessionId);
      if (!session) return;
      const threads = session.threads ?? [];
      const openCount = threads.filter(
        (t: SessionThread) => t.status === "open",
      ).length;
      statusBar.updateThreadCount(threads.length, openCount);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    }),
  );

  // Resolve workspace name from git repo root (handles worktrees).
  const resolveWorkspace = async () => {
    setWorkspaceRoot(workspaceRoot);
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

  const loadSession = async (sessionId: string) => {
    try {
      let session = await sessionStore.getSession(sessionId);

      // Auto-create session if none exists — extension works immediately
      if (!session) {
        session = {
          sessionId,
          worktreePath: workspaceRoot,
          sourceBranch: branchDetector.branchName ?? sessionId,
          targetBranch: "main",
          verdict: null,
          threads: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
        sessionStore.saveSession(sessionId, session);
        outputChannel.appendLine(
          `Auto-created review session for ${sessionId}`,
        );
      }

      const threads = session.threads ?? [];
      const openThreads = threads.filter(
        (t: SessionThread) => t.status === "open",
      ).length;
      commentManager.loadThreads(threads);
      statusBar.setReady(threads.length, openThreads);
      threadsTree.updateThreads(threads);
      outputChannel.appendLine(
        `Session loaded: ${threads.length} threads (${openThreads} open)`,
      );

      // Start watching the session file for external changes
      sessionWatcher.watch(getSessionFilePath(sessionId));

      // Populate sidebar tree with changed files
      await diffPanelManager.populate(sessionId);
      diffPanelManager.updateThreadCounts(threads);

      // Generate agent skill files (.review/AGENTS.md, .review/CLAUDE.md)
      try {
        const skillContext = await skillGenerator.buildContext(
          sessionId,
          getSessionFilePath(sessionId),
          session,
        );
        await skillGenerator.generate(skillContext, session);
        outputChannel.appendLine(`Agent skill files generated in .review/`);
      } catch (skillErr) {
        outputChannel.appendLine(
          `Skill generation failed: ${skillErr instanceof Error ? skillErr.message : String(skillErr)}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(
        `Failed to load session for ${sessionId}: ${msg}`,
      );
      void vscode.window.showErrorMessage(
        `Resolvr: Failed to load review session — ${msg}`,
      );
    }
  };

  // Initialize feature detection
  const init = async () => {
    await resolveWorkspace();
    const sessionId = await branchDetector.initialize();
    currentSessionId = sessionId;

    if (!sessionId) {
      statusBar.setNoBranch();
      outputChannel.appendLine("No working branch detected — dormant");
      return;
    }

    outputChannel.appendLine(`Working branch detected: ${sessionId}`);
    await loadSession(sessionId);
  };

  // Listen for branch changes
  branchDetector.onDidChangeBranch(async (newSessionId) => {
    outputChannel.appendLine(
      `Branch changed — session: ${newSessionId ?? "none"}`,
    );
    currentSessionId = newSessionId;
    sessionWatcher.unwatch();

    if (!newSessionId) {
      commentManager.loadThreads([]);
      threadsTree.updateThreads([]);
      diffPanelManager.close();
      statusBar.setNoBranch();
      return;
    }

    await loadSession(newSessionId);
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("resolvr.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode.commands.registerCommand("resolvr.startReview", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) {
        void vscode.window.showWarningMessage(
          "No working branch detected. Switch to a non-default branch first.",
        );
        return;
      }

      const existing = await sessionStore.getSession(sessionId);
      if (existing) {
        void vscode.window.showInformationMessage(
          "Review session already exists for this branch.",
        );
        return;
      }

      outputChannel.appendLine(`Creating new review session for ${sessionId}`);
      const session = {
        sessionId,
        worktreePath: workspaceRoot,
        sourceBranch: branchDetector.branchName ?? sessionId,
        targetBranch: "main",
        verdict: null as "approved" | "changes_requested" | null,
        threads: [] as SessionThread[],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      try {
        sessionStore.saveSession(sessionId, session);
        commentManager.loadThreads([]);
        statusBar.setReady(0);
        sessionWatcher.watch(getSessionFilePath(sessionId));
        currentSessionId = sessionId;
        await diffPanelManager.populate(sessionId);
        outputChannel.appendLine("Review session created");
        void vscode.window.showInformationMessage(
          `Review session created for ${sessionId}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to create session: ${msg}`);
        void vscode.window.showErrorMessage(
          `Failed to create review session: ${msg}`,
        );
      }
    }),
    vscode.commands.registerCommand("resolvr.requestChanges", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) {
        void vscode.window.showWarningMessage("No active working branch.");
        return;
      }

      outputChannel.appendLine(
        `Request Changes: setting verdict for ${sessionId}`,
      );

      try {
        await sessionStore.setVerdict(sessionId, "changes_requested");
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
    vscode.commands.registerCommand("resolvr.openDiff", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) {
        void vscode.window.showWarningMessage(
          "No working branch detected. Switch to a non-default branch first.",
        );
        return;
      }
      try {
        await diffPanelManager.open(sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`openDiff failed: ${msg}`);
        void vscode.window.showErrorMessage(
          `Resolvr: Failed to open diff — ${msg}`,
        );
      }
    }),

    vscode.commands.registerCommand(
      "resolvr.openDiffFile",
      async (file: unknown) => {
        if (file && typeof file === "object" && "path" in file) {
          await diffPanelManager.openFile(
            file as {
              path: string;
              oldPath: string;
              newPath: string;
              status: DiffStatus;
            },
          );
        }
      },
    ),

    vscode.commands.registerCommand(
      "resolvr.goToThread",
      async (filePath: string, line: number) => {
        const fileRef = diffPanelManager.getFileByPath(filePath) ?? {
          path: filePath,
          oldPath: filePath,
          newPath: filePath,
          status: DiffStatus.Modified,
        };
        await diffPanelManager.openFile(fileRef);
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

    vscode.commands.registerCommand("resolvr.refreshDiff", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) return;
      try {
        await diffPanelManager.refresh(sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`refreshDiff failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand("resolvr.closeDiff", () => {
      diffPanelManager.close();
    }),

    // View mode toggle: flat ↔ compact-tree
    vscode.commands.registerCommand("resolvr.toggleFileViewMode", () => {
      diffPanelManager.toggleViewMode();
    }),

    // Resolve open threads with AI agent
    vscode.commands.registerCommand("resolvr.resolveWithAI", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) {
        void vscode.window.showWarningMessage(
          "No working branch detected. Switch to a non-default branch first.",
        );
        return;
      }
      const session = await sessionStore.getSession(sessionId);
      if (!session) {
        void vscode.window.showWarningMessage(
          "No review session found. Start a review first.",
        );
        return;
      }

      const choice = await vscode.window.showQuickPick(
        [
          {
            label: "$(terminal) Send to existing terminal",
            description: "Send resolve prompt to an agent already running",
            mode: "existing" as const,
          },
          {
            label: "$(add) Start new agent",
            description: "Spawn a new agent process to resolve threads",
            mode: "new" as const,
          },
        ],
        { placeHolder: "How should the agent be invoked?" },
      );

      if (!choice) return;

      if (choice.mode === "existing") {
        await resolveInExistingTerminal(
          getSessionFilePath(sessionId),
          session,
          workspaceRoot,
          outputChannel,
        );
      } else {
        resolveWithNewAgent(
          getSessionFilePath(sessionId),
          session,
          workspaceRoot,
          outputChannel,
        );
      }
    }),

    // Regenerate agent skill files
    vscode.commands.registerCommand("resolvr.regenerateSkills", async () => {
      const sessionId = branchDetector.sessionId;
      if (!sessionId) {
        void vscode.window.showWarningMessage(
          "No working branch detected. Switch to a non-default branch first.",
        );
        return;
      }
      try {
        const session = await sessionStore.getSession(sessionId);
        const skillContext = await skillGenerator.buildContext(
          sessionId,
          getSessionFilePath(sessionId),
          session,
        );
        await skillGenerator.generate(skillContext, session);
        void vscode.window.showInformationMessage(
          "Agent skill files regenerated in .review/",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          `Failed to regenerate skills: ${msg}`,
        );
      }
    }),
  );

  // Run initialization
  void init();
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
