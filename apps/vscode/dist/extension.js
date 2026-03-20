"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode10 = __toESM(require("vscode"));
var import_child_process4 = require("child_process");
var import_util4 = require("util");
var path3 = __toESM(require("path"));

// src/featureDetector.ts
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
var import_util = require("util");
var path = __toESM(require("path"));
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
var FeatureDetector = class {
  _onDidChangeFeature = new vscode.EventEmitter();
  onDidChangeFeature = this._onDidChangeFeature.event;
  _currentFeatureId = null;
  _watcher;
  _workspaceRoot;
  get featureId() {
    return this._currentFeatureId;
  }
  get workspaceRoot() {
    return this._workspaceRoot;
  }
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
  }
  async initialize() {
    this._currentFeatureId = await this._detectFeatureId();
    await this._startWatching();
    return this._currentFeatureId;
  }
  async _detectFeatureId() {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        {
          cwd: this._workspaceRoot
        }
      );
      const branch = stdout.trim();
      const match = branch.match(/^feature\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  async _startWatching() {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--git-dir"],
        {
          cwd: this._workspaceRoot
        }
      );
      const gitDir = path.resolve(this._workspaceRoot, stdout.trim());
      const headPath = path.join(gitDir, "HEAD");
      this._watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          path.dirname(headPath),
          path.basename(headPath)
        )
      );
      const onHeadChange = async () => {
        const newFeatureId = await this._detectFeatureId();
        if (newFeatureId !== this._currentFeatureId) {
          this._currentFeatureId = newFeatureId;
          this._onDidChangeFeature.fire(newFeatureId);
        }
      };
      this._watcher.onDidChange(onHeadChange);
      this._watcher.onDidCreate(onHeadChange);
    } catch {
    }
  }
  dispose() {
    this._watcher?.dispose();
    this._onDidChangeFeature.dispose();
  }
};

// src/sessionStore.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var os = __toESM(require("os"));
var _workspaceName = null;
function setWorkspaceName(name) {
  _workspaceName = name;
}
function getSessionsDir() {
  if (!_workspaceName) throw new Error("Workspace name not set");
  return path2.join(
    os.homedir(),
    ".config",
    "local-review",
    "workspace",
    _workspaceName,
    "sessions"
  );
}
function getSessionFilePath(featureId) {
  return path2.join(getSessionsDir(), `${featureId}-code.json`);
}
function atomicWrite(filePath, data) {
  _onBeforeWrite?.();
  fs.mkdirSync(path2.dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, data);
  fs.renameSync(tmpFile, filePath);
}
var _onBeforeWrite = null;
function setOnBeforeWrite(callback) {
  _onBeforeWrite = callback;
}
function stampAndSerialize(session) {
  const stamped = {
    ...session,
    workspaceName: _workspaceName ?? void 0,
    metadata: { ...session.metadata, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  };
  return JSON.stringify(stamped, null, 2);
}
var sessionStore = {
  async getSession(featureId) {
    const filePath = getSessionFilePath(featureId);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  saveSession(featureId, session) {
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  },
  async createThread(featureId, thread) {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    session.threads.push(thread);
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
    return session;
  },
  async updateThread(featureId, threadId, patch) {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    const thread = session.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);
    if (patch.status !== void 0) thread.status = patch.status;
    if (patch.severity !== void 0) thread.severity = patch.severity;
    if (patch.labels) {
      thread.labels = { ...thread.labels, ...patch.labels };
    }
    if (patch.messages) {
      thread.messages.push(...patch.messages);
    }
    thread.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  },
  async setVerdict(featureId, verdict) {
    const session = await this.getSession(featureId);
    if (!session) throw new Error(`No session found for ${featureId}`);
    session.verdict = verdict;
    const filePath = getSessionFilePath(featureId);
    atomicWrite(filePath, stampAndSerialize(session));
  }
};

// src/statusBar.ts
var vscode2 = __toESM(require("vscode"));
var StatusBar = class {
  _item;
  _state = "no-feature";
  _threadCount = 0;
  constructor() {
    this._item = vscode2.window.createStatusBarItem(
      vscode2.StatusBarAlignment.Left,
      100
    );
    this._item.show();
    this._update();
  }
  setReady(threadCount) {
    this._state = "ready";
    this._threadCount = threadCount;
    this._update();
  }
  setNoFeature() {
    this._state = "no-feature";
    this._update();
  }
  setNoSession() {
    this._state = "no-session";
    this._item.command = "local-review.startReview";
    this._update();
  }
  updateThreadCount(count) {
    this._threadCount = count;
    if (this._state === "ready") {
      this._update();
    }
  }
  _update() {
    switch (this._state) {
      case "ready":
        this._item.text = `$(comment-discussion) Local Review: ${this._threadCount} threads`;
        this._item.tooltip = "Local Review";
        this._item.command = "local-review.refresh";
        this._item.backgroundColor = void 0;
        break;
      case "no-feature":
        this._item.text = "$(git-branch) Local Review: No active feature";
        this._item.tooltip = "Switch to a feature/* branch to activate";
        this._item.command = void 0;
        this._item.backgroundColor = void 0;
        break;
      case "no-session":
        this._item.text = "$(add) Local Review: Start Review";
        this._item.tooltip = "Click to create a new review session";
        this._item.command = "local-review.startReview";
        this._item.backgroundColor = void 0;
        break;
    }
  }
  dispose() {
    this._item.dispose();
  }
};

// src/commentManager.ts
var vscode4 = __toESM(require("vscode"));
var import_crypto = require("crypto");

// src/threadMapper.ts
var ThreadMapper = class {
  _sessionToVSCode = /* @__PURE__ */ new Map();
  _vsCodeToSession = /* @__PURE__ */ new Map();
  register(sessionId, thread) {
    this._sessionToVSCode.set(sessionId, thread);
    this._vsCodeToSession.set(thread, sessionId);
  }
  getVSCodeThread(sessionId) {
    return this._sessionToVSCode.get(sessionId);
  }
  getSessionId(thread) {
    return this._vsCodeToSession.get(thread);
  }
  disposeThread(sessionId) {
    const thread = this._sessionToVSCode.get(sessionId);
    if (thread) {
      thread.dispose();
      this._vsCodeToSession.delete(thread);
      this._sessionToVSCode.delete(sessionId);
    }
  }
  /** Dispose all tracked threads and recreate from fresh data (dispose-and-recreate pattern). */
  reconcile(newThreads, createThread) {
    for (const [, vsThread] of this._sessionToVSCode) {
      vsThread.dispose();
    }
    this._sessionToVSCode.clear();
    this._vsCodeToSession.clear();
    for (const sessionThread of newThreads) {
      const vsThread = createThread(sessionThread);
      if (vsThread) {
        this.register(sessionThread.id, vsThread);
      }
    }
  }
  clear() {
    for (const [, vsThread] of this._sessionToVSCode) {
      vsThread.dispose();
    }
    this._sessionToVSCode.clear();
    this._vsCodeToSession.clear();
  }
  get size() {
    return this._sessionToVSCode.size;
  }
  dispose() {
    this.clear();
  }
};

// src/baseContentProvider.ts
var vscode3 = __toESM(require("vscode"));
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var execFileAsync2 = (0, import_util2.promisify)(import_child_process2.execFile);
var BaseContentProvider = class {
  _onDidChange = new vscode3.EventEmitter();
  onDidChange = this._onDidChange.event;
  _cache = /* @__PURE__ */ new Map();
  _mergeBaseSha = null;
  _workspaceRoot;
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
  }
  async resolveMergeBase() {
    if (this._mergeBaseSha) return this._mergeBaseSha;
    try {
      const { stdout } = await execFileAsync2(
        "git",
        ["merge-base", "HEAD", "main"],
        { cwd: this._workspaceRoot }
      );
      this._mergeBaseSha = stdout.trim();
    } catch {
      this._mergeBaseSha = "main";
    }
    return this._mergeBaseSha;
  }
  async provideTextDocumentContent(uri) {
    const relativePath = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
    const cached = this._cache.get(relativePath);
    if (cached !== void 0) return cached;
    const ref = await this.resolveMergeBase();
    try {
      const { stdout } = await execFileAsync2(
        "git",
        ["show", `${ref}:${relativePath}`],
        { cwd: this._workspaceRoot, maxBuffer: 10 * 1024 * 1024 }
      );
      this._cache.set(relativePath, stdout);
      return stdout;
    } catch {
      this._cache.set(relativePath, "");
      return "";
    }
  }
  _buildUri(key) {
    return vscode3.Uri.parse(`${SCHEME_BASE}:/${key}`);
  }
  invalidate(path4) {
    if (path4) {
      const key = path4.startsWith("/") ? path4.slice(1) : path4;
      if (this._cache.delete(key)) {
        this._onDidChange.fire(this._buildUri(key));
      }
    } else {
      const keys = [...this._cache.keys()];
      this._cache.clear();
      this._mergeBaseSha = null;
      for (const key of keys) {
        this._onDidChange.fire(this._buildUri(key));
      }
    }
  }
  dispose() {
    this._onDidChange.dispose();
  }
};
var EmptyContentProvider = class {
  provideTextDocumentContent() {
    return "";
  }
};
var SCHEME_BASE = "local-review-base";
var SCHEME_EMPTY = "local-review-empty";

// src/commentManager.ts
var CommentManager = class _CommentManager {
  static STATUS_LABELS = {
    open: void 0,
    resolved: "Resolved",
    wontfix: "Won't Fix",
    outdated: "Outdated",
    approved: "Resolved"
  };
  static _statusLabel(status) {
    return _CommentManager.STATUS_LABELS[status];
  }
  _controller;
  _threadMapper;
  _workspaceRoot;
  _outputChannel;
  get threadMapper() {
    return this._threadMapper;
  }
  constructor(workspaceRoot, outputChannel) {
    this._workspaceRoot = workspaceRoot;
    this._outputChannel = outputChannel;
    this._threadMapper = new ThreadMapper();
    this._controller = vscode4.comments.createCommentController(
      "local-review",
      "Local Review"
    );
    this._controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        if (document.uri.scheme === "file" || document.uri.scheme === SCHEME_BASE) {
          return [new vscode4.Range(0, 0, document.lineCount - 1, 0)];
        }
        return [];
      }
    };
    this._controller.options = {
      placeHolder: "Add a review comment...",
      prompt: "Type your review comment"
    };
  }
  loadThreads(threads) {
    this._threadMapper.reconcile(threads, (t) => this._createVSCodeThread(t));
  }
  /**
   * Ensure a code review session exists for the given feature.
   * Creates one automatically if none exists (first-comment UX).
   */
  async _ensureSession(featureId) {
    const existing = await sessionStore.getSession(featureId);
    if (existing) return;
    const session = {
      featureId,
      worktreePath: this._workspaceRoot,
      sourceBranch: `feature/${featureId}`,
      targetBranch: "main",
      verdict: null,
      threads: [],
      metadata: {
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    sessionStore.saveSession(featureId, session);
    this._outputChannel.appendLine(
      `Auto-created review session for ${featureId}`
    );
  }
  /**
   * Register the comment action commands (create, reply, resolve, unresolve).
   * Must be called after the extension context is ready and a featureId is known.
   * The getFeatureId callback is used at command invocation time so it always
   * reflects the current branch's featureId.
   */
  setupCommentHandlers(context, getFeatureId, outputChannel) {
    context.subscriptions.push(
      // Create a new thread (user types in the "+" gutter inline box)
      // VS Code passes a single CommentReply object with { text, thread }
      vscode4.commands.registerCommand(
        "local-review.createComment",
        async (reply) => {
          const thread = reply.thread;
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode4.window.showWarningMessage(
              "Local Review: No active feature branch."
            );
            return;
          }
          if (!reply.text?.trim()) {
            return;
          }
          try {
            await this._ensureSession(featureId);
            const sessionThread = await this._buildNewThread(
              thread,
              reply.text.trim()
            );
            const updated = await sessionStore.createThread(
              featureId,
              sessionThread
            );
            thread.dispose();
            this.loadThreads(updated.threads);
            outputChannel.appendLine(
              `Created thread ${sessionThread.id} on ${sessionThread.anchor.path}:${sessionThread.anchor.line}`
            );
          } catch (err) {
            outputChannel.appendLine(`Failed to create thread: ${String(err)}`);
            void vscode4.window.showErrorMessage(
              `Local Review: Failed to create comment \u2014 ${String(err)}`
            );
          }
        }
      ),
      // Reply to an existing thread
      vscode4.commands.registerCommand(
        "local-review.replyToComment",
        async (reply) => {
          const thread = reply.thread;
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode4.window.showWarningMessage(
              "Local Review: No active feature branch."
            );
            return;
          }
          if (!reply.text?.trim()) {
            return;
          }
          const sessionId = this._threadMapper.getSessionId(thread);
          if (!sessionId) {
            outputChannel.appendLine(
              "replyToComment: thread not found in mapper \u2014 no session ID"
            );
            return;
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const newMessage = {
            id: crypto.randomUUID(),
            authorType: "human",
            author: "Reviewer",
            text: reply.text.trim(),
            createdAt: now
          };
          try {
            await sessionStore.updateThread(featureId, sessionId, {
              messages: [newMessage]
            });
            thread.comments = [
              ...thread.comments,
              this._createComment(newMessage)
            ];
            outputChannel.appendLine(`Replied to thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(`Failed to reply: ${String(err)}`);
            void vscode4.window.showErrorMessage(
              `Local Review: Failed to post reply \u2014 ${String(err)}`
            );
          }
        }
      ),
      ...this._registerStatusCommands(getFeatureId, outputChannel)
    );
  }
  /** Register all thread status change commands (resolve, reopen, wontfix, outdated). */
  _registerStatusCommands(getFeatureId, outputChannel) {
    const statusCommands = [
      {
        command: "local-review.resolveThread",
        status: "resolved",
        label: "Resolved"
      },
      {
        command: "local-review.unresolveThread",
        status: "open",
        label: "Re-opened"
      },
      {
        command: "local-review.wontfixThread",
        status: "wontfix",
        label: "Won't fix"
      },
      {
        command: "local-review.outdatedThread",
        status: "outdated",
        label: "Outdated"
      }
    ];
    return statusCommands.map(
      ({ command, status, label }) => vscode4.commands.registerCommand(
        command,
        async (thread) => {
          const featureId = getFeatureId();
          if (!featureId) return;
          const sessionId = this._threadMapper.getSessionId(thread);
          if (!sessionId) return;
          const closed = status !== "open";
          try {
            await sessionStore.updateThread(featureId, sessionId, { status });
            thread.state = closed ? 1 : 0;
            thread.collapsibleState = closed ? vscode4.CommentThreadCollapsibleState.Collapsed : vscode4.CommentThreadCollapsibleState.Expanded;
            thread.label = _CommentManager._statusLabel(status);
            outputChannel.appendLine(`${label} thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(
              `Failed to set ${label.toLowerCase()}: ${String(err)}`
            );
            void vscode4.window.showErrorMessage(
              `Local Review: Failed to set ${label.toLowerCase()} \u2014 ${String(err)}`
            );
          }
        }
      )
    );
  }
  async _buildNewThread(vsThread, text) {
    const uri = vsThread.uri;
    let relativePath;
    let side;
    if (uri.scheme === SCHEME_BASE) {
      relativePath = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
      side = "old";
    } else {
      relativePath = vscode4.workspace.asRelativePath(uri);
      side = "new";
    }
    const range = vsThread.range ?? new vscode4.Range(0, 0, 0, 0);
    const line = range.start.line + 1;
    const lineEnd = range.end.line + 1;
    const document = await vscode4.workspace.openTextDocument(uri);
    const lineContent = document.lineAt(range.start.line).text;
    const hash = (0, import_crypto.createHash)("sha256").update(lineContent).digest("hex").slice(0, 8);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const messageId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const message = {
      id: messageId,
      authorType: "human",
      author: "Reviewer",
      text,
      createdAt: now
    };
    const sessionThread = {
      id: threadId,
      anchor: {
        type: "diff-line",
        hash,
        path: relativePath,
        preview: lineContent.slice(0, 120),
        line,
        lineEnd,
        side
      },
      status: "open",
      severity: "improvement",
      messages: [message],
      lastUpdatedAt: now
    };
    return sessionThread;
  }
  _createVSCodeThread(sessionThread) {
    const anchor = sessionThread.anchor;
    const flat = sessionThread;
    const threadPath = anchor?.path ?? flat.filePath ?? "";
    const threadLine = anchor?.line ?? flat.line ?? 1;
    const threadLineEnd = anchor?.lineEnd ?? flat.lineEnd;
    const threadSide = anchor?.side ?? flat.side ?? "new";
    if (!threadPath) {
      this._outputChannel.appendLine(
        `Skipping thread ${sessionThread.id} \u2014 no file path`
      );
      return null;
    }
    let filePath;
    if (threadSide === "old") {
      filePath = vscode4.Uri.parse(`${SCHEME_BASE}:/${threadPath}`);
    } else {
      filePath = vscode4.Uri.file(`${this._workspaceRoot}/${threadPath}`);
    }
    const startLine = threadLine - 1;
    const endLine = (threadLineEnd ?? threadLine) - 1;
    const range = new vscode4.Range(startLine, 0, endLine, 0);
    const comments2 = sessionThread.messages.map(
      (msg) => this._createComment(msg)
    );
    const thread = this._controller.createCommentThread(
      filePath,
      range,
      comments2
    );
    thread.label = _CommentManager._statusLabel(sessionThread.status);
    const isNonOpen = sessionThread.status !== "open";
    const lastMsg = sessionThread.messages[sessionThread.messages.length - 1];
    const hasAgentReply = lastMsg?.authorType === "agent" && isNonOpen;
    thread.collapsibleState = !isNonOpen || hasAgentReply ? vscode4.CommentThreadCollapsibleState.Expanded : vscode4.CommentThreadCollapsibleState.Collapsed;
    thread.state = isNonOpen ? 1 : 0;
    return thread;
  }
  _createComment(msg) {
    return {
      body: new vscode4.MarkdownString(msg.text),
      mode: vscode4.CommentMode.Preview,
      author: {
        name: msg.authorType === "agent" ? `\u{1F916} ${msg.author}` : msg.author
      },
      timestamp: new Date(msg.createdAt)
    };
  }
  dispose() {
    this._threadMapper.dispose();
    this._controller.dispose();
  }
};

// src/sessionWatcher.ts
var vscode5 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var SessionWatcher = class {
  _watcher = null;
  _currentPath = null;
  _suppressUntil = 0;
  _outputChannel;
  _onDidSessionChange = new vscode5.EventEmitter();
  onDidSessionChange = this._onDidSessionChange.event;
  constructor(outputChannel) {
    this._outputChannel = outputChannel;
  }
  /**
   * Call before writing to suppress the file watcher echo.
   * Sets a 500ms suppression window.
   */
  suppressNextChange() {
    this._suppressUntil = Date.now() + 500;
  }
  /** Start watching a specific session file. */
  watch(sessionFilePath) {
    this.unwatch();
    this._currentPath = sessionFilePath;
    const pattern = new vscode5.RelativePattern(
      vscode5.Uri.file(sessionFilePath).with({
        path: vscode5.Uri.file(sessionFilePath).path.split("/").slice(0, -1).join("/")
      }),
      vscode5.Uri.file(sessionFilePath).path.split("/").pop()
    );
    this._watcher = vscode5.workspace.createFileSystemWatcher(pattern);
    const handleChange = () => {
      if (Date.now() < this._suppressUntil) {
        this._outputChannel.appendLine(
          "Session watcher: suppressed self-write"
        );
        return;
      }
      this._readAndEmit();
    };
    this._watcher.onDidChange(handleChange);
    this._watcher.onDidCreate(handleChange);
    this._outputChannel.appendLine(
      `Session watcher: watching ${sessionFilePath}`
    );
  }
  /** Stop watching the current file. */
  unwatch() {
    if (this._watcher) {
      this._watcher.dispose();
      this._watcher = null;
    }
    this._currentPath = null;
  }
  _readAndEmit() {
    if (!this._currentPath) return;
    try {
      const raw = fs2.readFileSync(this._currentPath, "utf-8");
      const session = JSON.parse(raw);
      this._outputChannel.appendLine(
        `Session watcher: external change detected \u2014 ${session.threads.length} threads`
      );
      this._onDidSessionChange.fire(session);
    } catch (err) {
      this._outputChannel.appendLine(
        `Session watcher: failed to read \u2014 ${String(err)}`
      );
    }
  }
  dispose() {
    this.unwatch();
    this._onDidSessionChange.dispose();
  }
};

// src/diffPanelManager.ts
var vscode8 = __toESM(require("vscode"));

// src/changedFilesTree.ts
var vscode7 = __toESM(require("vscode"));

// src/fileDecorationProvider.ts
var vscode6 = __toESM(require("vscode"));
var SCHEME_REVIEW_FILE = "local-review-file";
var STATUS_DECORATIONS = {
  A: {
    badge: "A",
    color: "gitDecoration.addedResourceForeground",
    tooltip: "Added"
  },
  D: {
    badge: "D",
    color: "gitDecoration.deletedResourceForeground",
    tooltip: "Deleted"
  },
  M: {
    badge: "M",
    color: "gitDecoration.modifiedResourceForeground",
    tooltip: "Modified"
  },
  R: {
    badge: "R",
    color: "gitDecoration.renamedResourceForeground",
    tooltip: "Renamed"
  }
};
function makeReviewFileUri(relativePath) {
  return vscode6.Uri.from({
    scheme: SCHEME_REVIEW_FILE,
    path: "/" + relativePath.replace(/^\/+/, "")
  });
}
var ReviewFileDecorationProvider = class {
  _onDidChange = new vscode6.EventEmitter();
  onDidChangeFileDecorations = this._onDidChange.event;
  _decorations = /* @__PURE__ */ new Map();
  _uris = [];
  setFiles(files) {
    this._decorations.clear();
    this._uris = [];
    for (const file of files) {
      const uri = makeReviewFileUri(file.path);
      const def = STATUS_DECORATIONS[file.status];
      const tooltip = file.status === "R" ? `Renamed: ${file.oldPath} \u2192 ${file.newPath}` : def.tooltip;
      this._decorations.set(
        uri.path,
        new vscode6.FileDecoration(
          def.badge,
          tooltip,
          new vscode6.ThemeColor(def.color)
        )
      );
      this._uris.push(uri);
    }
    this._onDidChange.fire(this._uris);
  }
  clear() {
    const prev = this._uris;
    this._decorations.clear();
    this._uris = [];
    if (prev.length > 0) {
      this._onDidChange.fire(prev);
    }
  }
  provideFileDecoration(uri) {
    if (uri.scheme !== SCHEME_REVIEW_FILE) return void 0;
    return this._decorations.get(uri.path);
  }
  dispose() {
    this._decorations.clear();
    this._uris = [];
    this._onDidChange.dispose();
  }
};

// src/changedFilesTree.ts
var EXT_ICON_MAP = {
  ts: "symbol-file",
  tsx: "symbol-file",
  js: "symbol-file",
  jsx: "symbol-file",
  json: "json",
  md: "markdown",
  css: "symbol-color",
  scss: "symbol-color",
  html: "code",
  svg: "symbol-misc",
  png: "file-media",
  jpg: "file-media",
  gif: "file-media",
  yaml: "list-tree",
  yml: "list-tree",
  sh: "terminal",
  bash: "terminal",
  lock: "lock"
};
function getFileIcon(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICON_MAP[ext] ?? "file";
}
var STATUS_COLORS = {
  A: "gitDecoration.addedResourceForeground",
  D: "gitDecoration.deletedResourceForeground",
  M: "gitDecoration.modifiedResourceForeground",
  R: "gitDecoration.renamedResourceForeground"
};
var STATUS_LABELS = {
  A: "Added",
  D: "Deleted",
  M: "Modified",
  R: "Renamed"
};
var ChangedFilesTreeProvider = class {
  _onDidChangeTreeData = new vscode7.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _files = [];
  setFiles(files) {
    this._files = files.map((f) => ({ ...f, openThreads: 0 }));
    this._onDidChangeTreeData.fire();
  }
  updateThreadCounts(threads) {
    const counts = /* @__PURE__ */ new Map();
    for (const t of threads) {
      if (t.status !== "open") continue;
      const path4 = t.anchor?.path;
      if (path4) counts.set(path4, (counts.get(path4) ?? 0) + 1);
    }
    let changed = false;
    for (const file of this._files) {
      const count = (counts.get(file.path) ?? 0) + (file.oldPath !== file.path ? counts.get(file.oldPath) ?? 0 : 0);
      if (file.openThreads !== count) {
        file.openThreads = count;
        changed = true;
      }
    }
    if (changed) this._onDidChangeTreeData.fire();
  }
  get fileCount() {
    return this._files.length;
  }
  getFirstFile() {
    return this._files[0];
  }
  getTreeItem(element) {
    const label = element.path.split("/").pop() ?? element.path;
    const item = new vscode7.TreeItem(
      label,
      vscode7.TreeItemCollapsibleState.None
    );
    item.resourceUri = makeReviewFileUri(element.path);
    const parts = [];
    if (element.path.includes("/")) {
      parts.push(element.path.slice(0, element.path.lastIndexOf("/")));
    }
    if (element.additions + element.deletions > 0) {
      parts.push(`+${element.additions}/\u2212${element.deletions}`);
    }
    if (element.openThreads > 0) {
      const suffix = `${element.openThreads} comment${element.openThreads > 1 ? "s" : ""}`;
      parts.push(parts.length > 0 ? `\xB7 ${suffix}` : suffix);
    }
    item.description = parts.length > 0 ? parts.join(" ") : void 0;
    item.iconPath = new vscode7.ThemeIcon(
      getFileIcon(element.path),
      new vscode7.ThemeColor(STATUS_COLORS[element.status])
    );
    item.command = {
      command: "local-review.openDiffFile",
      title: "Open Diff",
      arguments: [element]
    };
    const statusLabel = STATUS_LABELS[element.status];
    const tooltipLines = [`${statusLabel}: ${element.path}`];
    if (element.status === "R") {
      tooltipLines.push(`${element.oldPath} \u2192 ${element.newPath}`);
    }
    if (element.additions + element.deletions > 0) {
      tooltipLines.push(
        `+${element.additions} additions, ${element.deletions} deletions`
      );
    }
    if (element.openThreads > 0) {
      tooltipLines.push(
        `${element.openThreads} open comment${element.openThreads > 1 ? "s" : ""}`
      );
    }
    item.tooltip = tooltipLines.join("\n");
    return item;
  }
  getParent(_element) {
    return void 0;
  }
  getChildren() {
    return this._files;
  }
};

// src/diffParser.ts
function parseDiffFileList(unifiedDiff) {
  if (!unifiedDiff.trim()) return [];
  const blocks = unifiedDiff.split(/^diff --git /m).slice(1);
  const entries = [];
  for (const block of blocks) {
    const headerMatch = block.match(/^a\/(.+) b\/(.+)$/m);
    if (!headerMatch) continue;
    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];
    let status = "M";
    if (/^new file mode/m.test(block)) {
      status = "A";
    } else if (/^deleted file mode/m.test(block)) {
      status = "D";
    } else if (/^rename from /m.test(block)) {
      status = "R";
    }
    let additions = 0;
    let deletions = 0;
    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    entries.push({
      path: status === "D" ? oldPath : newPath,
      oldPath,
      newPath,
      status,
      additions,
      deletions
    });
  }
  return entries;
}

// src/gitDiff.ts
var import_child_process3 = require("child_process");
var import_util3 = require("util");
var execFileAsync3 = (0, import_util3.promisify)(import_child_process3.execFile);
async function gitExec(args, cwd) {
  try {
    const { stdout } = await execFileAsync3("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout;
  } catch (err) {
    const execErr = err;
    if (execErr.stdout !== void 0) {
      return execErr.stdout;
    }
    throw err;
  }
}
async function getLocalDiff(workspaceRoot, featureId) {
  const sourceBranch = (await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], workspaceRoot)).trim();
  let targetBranch = "main";
  if (featureId) {
    const session = await sessionStore.getSession(featureId);
    if (session?.targetBranch) {
      targetBranch = session.targetBranch;
    }
  }
  const committedDiff = await gitExec(
    ["diff", `${targetBranch}...HEAD`],
    workspaceRoot
  );
  const uncommittedDiff = await gitExec(["diff", "HEAD"], workspaceRoot);
  const allDiff = await gitExec(["diff", targetBranch], workspaceRoot);
  return {
    worktreePath: workspaceRoot,
    sourceBranch,
    targetBranch,
    committedDiff,
    uncommittedDiff,
    allDiff
  };
}

// src/diffPanelManager.ts
function makeSchemeUri(scheme, relativePath) {
  return vscode8.Uri.from({ scheme, path: "/" + relativePath });
}
var DiffPanelManager = class {
  _files = [];
  _viewedFiles = /* @__PURE__ */ new Set();
  _baseProvider;
  _treeProvider;
  _decorationProvider;
  _decorationDisposable;
  _workspaceRoot;
  _outputChannel;
  _treeView;
  get treeProvider() {
    return this._treeProvider;
  }
  constructor(workspaceRoot, baseProvider, outputChannel) {
    this._workspaceRoot = workspaceRoot;
    this._baseProvider = baseProvider;
    this._outputChannel = outputChannel;
    this._treeProvider = new ChangedFilesTreeProvider();
    this._decorationProvider = new ReviewFileDecorationProvider();
    this._decorationDisposable = vscode8.window.registerFileDecorationProvider(
      this._decorationProvider
    );
    this._treeView = vscode8.window.createTreeView("localReview.changedFiles", {
      treeDataProvider: this._treeProvider
    });
  }
  /**
   * Populate the sidebar tree with changed files without opening a diff tab.
   * Used on activation so the activity bar shows file list immediately.
   */
  async populate(featureId) {
    this._decorationProvider.clear();
    try {
      const diff = await getLocalDiff(this._workspaceRoot, featureId);
      this._files = parseDiffFileList(diff.allDiff);
      this._treeProvider.setFiles(this._files);
      this._decorationProvider.setFiles(this._files);
      this._updateTitle();
      void vscode8.commands.executeCommand(
        "setContext",
        "local-review.hasDiffPanel",
        this._files.length > 0
      );
      this._outputChannel.appendLine(
        `Diff tree populated for ${featureId}: ${this._files.length} files`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._outputChannel.appendLine(`Failed to populate diff tree: ${msg}`);
      this._treeProvider.setFiles([]);
    }
  }
  async open(featureId) {
    await this.populate(featureId);
    if (this._files.length === 0) {
      void vscode8.window.showInformationMessage(
        "No changes found between main and working tree."
      );
      return;
    }
    const firstItem = this._treeProvider.getFirstFile();
    if (firstItem) {
      void this._treeView.reveal(firstItem, { focus: true });
    }
    await this.openFile(this._files[0]);
  }
  async openFile(file) {
    let oldUri;
    let newUri;
    switch (file.status) {
      case "D":
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = makeSchemeUri(SCHEME_EMPTY, file.oldPath);
        break;
      case "A":
        oldUri = makeSchemeUri(SCHEME_EMPTY, file.newPath);
        newUri = vscode8.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      case "R":
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = vscode8.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      default:
        oldUri = makeSchemeUri(SCHEME_BASE, file.path);
        newUri = vscode8.Uri.file(`${this._workspaceRoot}/${file.path}`);
    }
    const title = file.status === "R" ? `${file.oldPath} \u2192 ${file.newPath} (Review Diff)` : `${file.path} (Review Diff)`;
    await vscode8.commands.executeCommand("vscode.diff", oldUri, newUri, title);
    this._viewedFiles.add(file.path);
    this._updateTitle();
  }
  _updateTitle() {
    if (this._files.length === 0) return;
    const viewed = this._viewedFiles.size;
    const total = this._files.length;
    this._treeView.title = viewed > 0 ? `Changed Files (${viewed}/${total} viewed)` : `Changed Files (${total})`;
  }
  async refresh(featureId) {
    this._baseProvider.invalidate();
    await this.populate(featureId);
  }
  close() {
    if (this._files.length === 0) return;
    this._treeProvider.setFiles([]);
    this._decorationProvider.clear();
    this._files = [];
    this._viewedFiles.clear();
    void vscode8.commands.executeCommand(
      "setContext",
      "local-review.hasDiffPanel",
      false
    );
  }
  updateThreadCounts(threads) {
    if (this._files.length === 0) return;
    this._treeProvider.updateThreadCounts(threads);
  }
  dispose() {
    this._treeView.dispose();
    this._decorationProvider.dispose();
    this._decorationDisposable.dispose();
  }
};

// src/threadsTree.ts
var vscode9 = __toESM(require("vscode"));
var STATUS_GROUPS = [
  {
    status: "open",
    label: "Open",
    icon: "circle-filled",
    color: "list.warningForeground"
  },
  {
    status: "resolved",
    label: "Resolved",
    icon: "check",
    color: "testing.iconPassed"
  },
  {
    status: "wontfix",
    label: "Won't Fix",
    icon: "circle-slash",
    color: "disabledForeground"
  },
  {
    status: "outdated",
    label: "Outdated",
    icon: "history",
    color: "editorInfo.foreground"
  }
];
var ThreadsTreeProvider = class {
  _onDidChangeTreeData = new vscode9.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _threads = [];
  updateThreads(threads) {
    this._threads = threads;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    if (element.kind === "group") {
      const item2 = new vscode9.TreeItem(
        `${element.label} (${element.threads.length})`,
        element.threads.length > 0 ? vscode9.TreeItemCollapsibleState.Expanded : vscode9.TreeItemCollapsibleState.None
      );
      item2.iconPath = new vscode9.ThemeIcon(
        element.icon,
        new vscode9.ThemeColor(element.color)
      );
      item2.contextValue = "threadGroup";
      return item2;
    }
    const t = element.thread;
    const raw = t;
    const filePath = t.anchor?.path ?? (typeof raw.filePath === "string" ? raw.filePath : "") ?? "";
    const fileName = filePath ? filePath.split("/").pop() ?? filePath : "unknown";
    const line = t.anchor?.line ?? (typeof raw.line === "number" ? raw.line : 0);
    const preview = t.messages[0]?.text.slice(0, 60).replace(/\n/g, " ") ?? "";
    const item = new vscode9.TreeItem(
      `${fileName}:${line}`,
      vscode9.TreeItemCollapsibleState.None
    );
    item.description = preview;
    item.tooltip = `${filePath}:${line}
${preview}`;
    item.iconPath = new vscode9.ThemeIcon("comment");
    if (filePath) {
      item.command = {
        command: "local-review.goToThread",
        title: "Go to Thread",
        arguments: [filePath, line]
      };
    }
    return item;
  }
  getChildren(element) {
    if (!element) {
      return this._buildGroups().filter((g) => g.threads.length > 0);
    }
    if (element.kind === "group") {
      return element.threads.map((thread) => ({
        kind: "thread",
        thread
      }));
    }
    return [];
  }
  getParent(_element) {
    return void 0;
  }
  _buildGroups() {
    const normalize = (s) => s === "approved" ? "resolved" : s;
    return STATUS_GROUPS.map((def) => ({
      kind: "group",
      ...def,
      threads: this._threads.filter((t) => normalize(t.status) === def.status)
    }));
  }
};

// src/extension.ts
var execFileAsync4 = (0, import_util4.promisify)(import_child_process4.execFile);
function activate(context) {
  const outputChannel = vscode10.window.createOutputChannel("Local Review");
  outputChannel.appendLine("Local Review extension activated");
  const workspaceRoot = vscode10.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found \u2014 going dormant");
    return;
  }
  const baseProvider = new BaseContentProvider(workspaceRoot);
  const emptyProvider = new EmptyContentProvider();
  context.subscriptions.push(
    vscode10.workspace.registerTextDocumentContentProvider(
      SCHEME_BASE,
      baseProvider
    ),
    vscode10.workspace.registerTextDocumentContentProvider(
      SCHEME_EMPTY,
      emptyProvider
    ),
    baseProvider
  );
  const statusBar = new StatusBar();
  const featureDetector = new FeatureDetector(workspaceRoot);
  const commentManager = new CommentManager(workspaceRoot, outputChannel);
  const sessionWatcher = new SessionWatcher(outputChannel);
  setOnBeforeWrite(() => sessionWatcher.suppressNextChange());
  const diffPanelManager = new DiffPanelManager(
    workspaceRoot,
    baseProvider,
    outputChannel
  );
  const threadsTree = new ThreadsTreeProvider();
  const threadsTreeView = vscode10.window.createTreeView("localReview.threads", {
    treeDataProvider: threadsTree,
    showCollapseAll: true
  });
  context.subscriptions.push(
    statusBar,
    featureDetector,
    commentManager,
    sessionWatcher,
    diffPanelManager,
    threadsTreeView,
    outputChannel
  );
  commentManager.setupCommentHandlers(
    context,
    () => featureDetector.featureId,
    outputChannel
  );
  let currentFeatureId = null;
  context.subscriptions.push(
    sessionWatcher.onDidSessionChange((session) => {
      if (!currentFeatureId) return;
      const threads = session.threads ?? [];
      outputChannel.appendLine(
        `Session file changed: reconciling ${threads.length} threads for ${currentFeatureId}`
      );
      commentManager.loadThreads(threads);
      statusBar.updateThreadCount(threads.length);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    })
  );
  const resolveWorkspace = async () => {
    try {
      const { stdout } = await execFileAsync4(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: workspaceRoot }
      );
      const gitCommonDir = path3.resolve(workspaceRoot, stdout.trim());
      const repoName = path3.basename(path3.dirname(gitCommonDir));
      setWorkspaceName(repoName);
      outputChannel.appendLine(`Workspace resolved: ${repoName}`);
    } catch {
      const fallback = path3.basename(workspaceRoot);
      setWorkspaceName(fallback);
      outputChannel.appendLine(`Workspace fallback: ${fallback}`);
    }
  };
  const loadSession = async (featureId) => {
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
      (t) => t.status === "open"
    ).length;
    commentManager.loadThreads(threads);
    statusBar.setReady(threads.length);
    threadsTree.updateThreads(threads);
    outputChannel.appendLine(
      `Session loaded: ${threads.length} threads (${openThreads} open)`
    );
    sessionWatcher.watch(getSessionFilePath(featureId));
    await diffPanelManager.populate(featureId);
    diffPanelManager.updateThreadCounts(threads);
  };
  const init = async () => {
    await resolveWorkspace();
    const featureId = await featureDetector.initialize();
    currentFeatureId = featureId;
    if (!featureId) {
      statusBar.setNoFeature();
      outputChannel.appendLine("No feature branch detected \u2014 dormant");
      return;
    }
    outputChannel.appendLine(`Feature detected: ${featureId}`);
    await loadSession(featureId);
  };
  featureDetector.onDidChangeFeature(async (newFeatureId) => {
    outputChannel.appendLine(
      `Branch changed \u2014 new feature: ${newFeatureId ?? "none"}`
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
  context.subscriptions.push(
    vscode10.commands.registerCommand("local-review.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode10.commands.registerCommand("local-review.startReview", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode10.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first."
        );
        return;
      }
      const existing = await sessionStore.getSession(featureId);
      if (existing) {
        void vscode10.window.showInformationMessage(
          "Review session already exists for this feature."
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
        threads: [],
        metadata: {
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
      try {
        sessionStore.saveSession(featureId, session);
        commentManager.loadThreads([]);
        statusBar.setReady(0);
        sessionWatcher.watch(getSessionFilePath(featureId));
        currentFeatureId = featureId;
        await diffPanelManager.populate(featureId);
        outputChannel.appendLine("Review session created");
        void vscode10.window.showInformationMessage(
          `Review session created for ${featureId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to create session: ${msg}`);
        void vscode10.window.showErrorMessage(
          `Failed to create review session: ${msg}`
        );
      }
    }),
    vscode10.commands.registerCommand("local-review.requestChanges", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode10.window.showWarningMessage("No active feature.");
        return;
      }
      outputChannel.appendLine(
        `Request Changes: setting verdict for ${featureId}`
      );
      try {
        await sessionStore.setVerdict(featureId, "changes_requested");
        void vscode10.window.showInformationMessage(
          "Verdict saved. Run /resolve in your Claude session to process threads."
        );
        outputChannel.appendLine("Verdict set to changes_requested");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Request Changes failed: ${msg}`);
        void vscode10.window.showErrorMessage(`Failed to set verdict: ${msg}`);
      }
    }),
    // Diff panel commands
    vscode10.commands.registerCommand("local-review.openDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode10.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first."
        );
        return;
      }
      await diffPanelManager.open(featureId);
    }),
    vscode10.commands.registerCommand(
      "local-review.openDiffFile",
      async (file) => {
        if (file && typeof file === "object" && "path" in file) {
          await diffPanelManager.openFile(
            file
          );
        }
      }
    ),
    vscode10.commands.registerCommand(
      "local-review.goToThread",
      async (filePath, line) => {
        await diffPanelManager.openFile({
          path: filePath,
          oldPath: filePath,
          newPath: filePath,
          status: "M"
        });
        setTimeout(() => {
          const editor = vscode10.window.activeTextEditor;
          if (editor) {
            const pos = new vscode10.Position(Math.max(0, line - 1), 0);
            editor.revealRange(
              new vscode10.Range(pos, pos),
              vscode10.TextEditorRevealType.InCenter
            );
          }
        }, 300);
      }
    ),
    vscode10.commands.registerCommand("local-review.refreshDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) return;
      await diffPanelManager.refresh(featureId);
    }),
    vscode10.commands.registerCommand("local-review.closeDiff", () => {
      diffPanelManager.close();
    })
  );
  void init();
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
