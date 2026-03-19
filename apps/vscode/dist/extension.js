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
var vscode5 = __toESM(require("vscode"));

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

// src/serverClient.ts
var vscode2 = __toESM(require("vscode"));
function getBaseUrl() {
  return vscode2.workspace.getConfiguration("local-review").get("serverUrl", "http://localhost:37003");
}
async function apiFetch(path2, options) {
  const url = `${getBaseUrl()}/api/features${path2}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
var serverClient = {
  async getSession(featureId) {
    try {
      return await apiFetch(
        `/${encodeURIComponent(featureId)}/code-session`
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        return null;
      }
      throw err;
    }
  },
  async saveSession(featureId, session) {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session`, {
      method: "POST",
      body: JSON.stringify(session)
    });
  },
  async createThread(featureId, thread) {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session/threads`, {
      method: "POST",
      body: JSON.stringify(thread)
    });
  },
  async updateThread(featureId, threadId, patch) {
    await apiFetch(
      `/${encodeURIComponent(featureId)}/code-session/threads/${encodeURIComponent(threadId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch)
      }
    );
  },
  async setVerdict(featureId, verdict) {
    await apiFetch(`/${encodeURIComponent(featureId)}/code-session`, {
      method: "POST",
      body: JSON.stringify({ verdict })
    });
  },
  async triggerResolve(featureId, sessionType = "code") {
    const url = `${getBaseUrl()}/api/resolver/resolve`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId, sessionType })
    });
    return res.json();
  },
  async checkConnection() {
    try {
      const url = `${getBaseUrl()}/api/features`;
      const res = await fetch(url, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
};

// src/statusBar.ts
var vscode3 = __toESM(require("vscode"));
var StatusBar = class {
  _item;
  _state = "disconnected";
  _threadCount = 0;
  _resolveProgress = { current: 0, total: 0 };
  constructor() {
    this._item = vscode3.window.createStatusBarItem(
      vscode3.StatusBarAlignment.Left,
      100
    );
    this._item.show();
    this._update();
  }
  setConnected(threadCount) {
    this._state = "connected";
    this._threadCount = threadCount;
    this._update();
  }
  setDisconnected() {
    this._state = "disconnected";
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
  setResolving(current, total) {
    this._state = "resolving";
    this._resolveProgress = { current, total };
    this._update();
  }
  setResolveComplete(resolved) {
    this._state = "connected";
    this._item.text = `$(check) Local Review: ${resolved} resolved`;
    setTimeout(() => this._update(), 5e3);
  }
  setResolveFailed(error) {
    this._state = "connected";
    this._item.text = `$(error) Local Review: Resolve failed`;
    this._item.tooltip = error;
    setTimeout(() => this._update(), 1e4);
  }
  updateThreadCount(count) {
    this._threadCount = count;
    if (this._state === "connected") {
      this._update();
    }
  }
  _update() {
    switch (this._state) {
      case "connected":
        this._item.text = `$(comment-discussion) Local Review: ${this._threadCount} threads`;
        this._item.tooltip = "Local Review: Connected";
        this._item.command = "local-review.refresh";
        this._item.backgroundColor = void 0;
        break;
      case "disconnected":
        this._item.text = "$(debug-disconnect) Local Review: Disconnected";
        this._item.tooltip = "Local Review: Server not reachable";
        this._item.command = "local-review.connect";
        this._item.backgroundColor = new vscode3.ThemeColor(
          "statusBarItem.warningBackground"
        );
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
      case "resolving":
        this._item.text = `$(sync~spin) Local Review: Resolving ${this._resolveProgress.current}/${this._resolveProgress.total}`;
        this._item.tooltip = "Resolver agent is processing threads...";
        this._item.command = void 0;
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

// src/commentManager.ts
var CommentManager = class {
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
  }
  loadThreads(threads) {
    this._threadMapper.reconcile(threads, (t) => this._createVSCodeThread(t));
  }
  _createVSCodeThread(sessionThread) {
    if (sessionThread.anchor.side === "old") {
      this._outputChannel.appendLine(
        `Skipping old-side thread ${sessionThread.id} on ${sessionThread.anchor.path}:${sessionThread.anchor.line}`
      );
      return null;
    }
    const filePath = vscode4.Uri.file(
      `${this._workspaceRoot}/${sessionThread.anchor.path}`
    );
    const startLine = sessionThread.anchor.line - 1;
    const endLine = (sessionThread.anchor.lineEnd ?? sessionThread.anchor.line) - 1;
    const range = new vscode4.Range(startLine, 0, endLine, 0);
    const comments2 = sessionThread.messages.map(
      (msg) => this._createComment(msg)
    );
    const thread = this._controller.createCommentThread(
      filePath,
      range,
      comments2
    );
    thread.label = sessionThread.severity ? `[${sessionThread.severity}]` : void 0;
    thread.collapsibleState = sessionThread.status === "open" ? vscode4.CommentThreadCollapsibleState.Expanded : vscode4.CommentThreadCollapsibleState.Collapsed;
    thread.state = sessionThread.status === "resolved" ? 1 : 0;
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

// src/extension.ts
function activate(context) {
  const outputChannel = vscode5.window.createOutputChannel("Local Review");
  outputChannel.appendLine("Local Review extension activated");
  const workspaceRoot = vscode5.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found \u2014 going dormant");
    return;
  }
  const statusBar = new StatusBar();
  const featureDetector = new FeatureDetector(workspaceRoot);
  const commentManager = new CommentManager(workspaceRoot, outputChannel);
  context.subscriptions.push(
    statusBar,
    featureDetector,
    commentManager,
    outputChannel
  );
  const init = async () => {
    const featureId = await featureDetector.initialize();
    if (!featureId) {
      statusBar.setNoFeature();
      outputChannel.appendLine("No feature branch detected \u2014 dormant");
      return;
    }
    outputChannel.appendLine(`Feature detected: ${featureId}`);
    const connected = await serverClient.checkConnection();
    if (!connected) {
      statusBar.setDisconnected();
      outputChannel.appendLine("Server not reachable");
      return;
    }
    const session = await serverClient.getSession(featureId);
    if (!session) {
      statusBar.setNoSession();
      outputChannel.appendLine("No review session found");
      return;
    }
    const openThreads = session.threads.filter(
      (t) => t.status === "open"
    ).length;
    commentManager.loadThreads(session.threads);
    statusBar.setConnected(session.threads.length);
    outputChannel.appendLine(
      `Session loaded: ${session.threads.length} threads (${openThreads} open)`
    );
  };
  featureDetector.onDidChangeFeature(async (newFeatureId) => {
    outputChannel.appendLine(
      `Branch changed \u2014 new feature: ${newFeatureId ?? "none"}`
    );
    if (!newFeatureId) {
      commentManager.loadThreads([]);
      statusBar.setNoFeature();
      return;
    }
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
      `Session loaded for ${newFeatureId}: ${session.threads.length} threads`
    );
  });
  context.subscriptions.push(
    vscode5.commands.registerCommand("local-review.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode5.commands.registerCommand("local-review.connect", () => {
      outputChannel.appendLine("Connect command invoked");
      void init();
    }),
    vscode5.commands.registerCommand("local-review.disconnect", () => {
      outputChannel.appendLine("Disconnect command invoked");
      statusBar.setDisconnected();
    }),
    vscode5.commands.registerCommand("local-review.startReview", () => {
      outputChannel.appendLine("Start Review command invoked");
    }),
    vscode5.commands.registerCommand("local-review.requestChanges", () => {
      outputChannel.appendLine("Request Changes command invoked");
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
