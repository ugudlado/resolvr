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
var vscode11 = __toESM(require("vscode"));
var import_child_process5 = require("child_process");
var import_util5 = require("util");
var path5 = __toESM(require("path"));

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
var _workspaceRoot = null;
var _workspaceName = null;
function setWorkspaceRoot(root) {
  _workspaceRoot = root;
}
function setWorkspaceName(name) {
  _workspaceName = name;
}
function getSessionsDir() {
  if (!_workspaceRoot) throw new Error("Workspace root not set");
  return path2.join(_workspaceRoot, ".review", "sessions");
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
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw new Error(
        `Failed to read session for ${featureId}: ${String(err)}`
      );
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

// src/skillGenerator.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var execFileAsync2 = (0, import_util2.promisify)(import_child_process2.execFile);
var SkillGenerator = class {
  _workspaceRoot;
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
  }
  /**
   * Generate agent skill files for the current review context.
   * Creates .review/AGENTS.md (universal) and .review/CLAUDE.md (Claude Code shim).
   */
  async generate(context, session) {
    const reviewDir = path3.join(this._workspaceRoot, ".review");
    fs2.mkdirSync(reviewDir, { recursive: true });
    const agentsMd = this._renderAgentsMd(context, session);
    const claudeMd = this._renderClaudeMd();
    fs2.writeFileSync(path3.join(reviewDir, "AGENTS.md"), agentsMd);
    fs2.writeFileSync(path3.join(reviewDir, "CLAUDE.md"), claudeMd);
  }
  /**
   * Build a SkillContext from the current workspace state.
   */
  async buildContext(featureId, sessionFilePath, session) {
    const repoName = await this._getRepoName();
    const sourceBranch = session?.sourceBranch ?? `feature/${featureId}`;
    const targetBranch = session?.targetBranch ?? "main";
    const changedFiles = await this._getChangedFiles(targetBranch);
    return {
      repoName,
      featureId,
      sessionFilePath,
      sourceBranch,
      targetBranch,
      workspaceRoot: this._workspaceRoot,
      changedFiles
    };
  }
  async _getRepoName() {
    try {
      const { stdout } = await execFileAsync2(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: this._workspaceRoot }
      );
      const gitCommonDir = path3.resolve(this._workspaceRoot, stdout.trim());
      return path3.basename(path3.dirname(gitCommonDir));
    } catch {
      return path3.basename(this._workspaceRoot);
    }
  }
  async _getChangedFiles(targetBranch) {
    try {
      const { stdout } = await execFileAsync2(
        "git",
        ["diff", "--name-only", targetBranch],
        { cwd: this._workspaceRoot }
      );
      return stdout.trim().split("\n").filter((f) => f.length > 0);
    } catch {
      return [];
    }
  }
  _renderAgentsMd(ctx, session) {
    const openThreads = session?.threads.filter((t) => t.status === "open") ?? [];
    const resolvedThreads = session?.threads.filter((t) => t.status === "resolved") ?? [];
    return `# Code Review \u2014 ${ctx.repoName}

You are participating in a code review for the \`${ctx.featureId}\` feature.
Your role is to review code changes, respond to review threads, and resolve issues.

## Current State

- **Feature**: \`${ctx.featureId}\`
- **Branch**: \`${ctx.sourceBranch}\` \u2192 \`${ctx.targetBranch}\`
- **Session file**: \`${ctx.sessionFilePath}\`
- **Open threads**: ${openThreads.length}
- **Resolved threads**: ${resolvedThreads.length}
- **Changed files**: ${ctx.changedFiles.length}

### Changed Files

${ctx.changedFiles.map((f) => `- \`${f}\``).join("\n") || "- (no changes detected)"}

## Session File Protocol

The review session is stored as a JSON file. You interact with the review by reading
and writing this file. The VS Code extension watches the file and updates the UI
automatically when you make changes.

**Session file location**: \`${ctx.sessionFilePath}\`

### Session Schema

\`\`\`json
{
  "featureId": "string \u2014 feature identifier",
  "worktreePath": "string \u2014 absolute path to workspace",
  "sourceBranch": "string \u2014 feature branch name",
  "targetBranch": "string \u2014 merge target (usually main)",
  "verdict": "null | 'approved' | 'changes_requested'",
  "threads": [
    {
      "id": "string \u2014 UUID v4",
      "anchor": {
        "type": "diff-line",
        "hash": "string \u2014 SHA-256 hash of line content (first 16 chars)",
        "path": "string \u2014 file path relative to repo root",
        "preview": "string \u2014 first 80 chars of the anchored line",
        "line": "number \u2014 1-based line number",
        "lineEnd": "number | undefined \u2014 end line for multi-line anchors",
        "side": "'old' | 'new' \u2014 which side of the diff"
      },
      "status": "'open' | 'resolved' | 'wontfix' | 'outdated'",
      "severity": "'critical' | 'improvement' | 'style' | 'question'",
      "messages": [
        {
          "id": "string \u2014 UUID v4",
          "authorType": "'human' | 'agent'",
          "author": "string \u2014 display name",
          "text": "string \u2014 markdown content",
          "createdAt": "string \u2014 ISO 8601 timestamp"
        }
      ],
      "lastUpdatedAt": "string \u2014 ISO 8601 timestamp",
      "labels": "Record<string, string> | undefined",
      "resolvedByModel": "string | undefined \u2014 model that resolved this",
      "resolvedWithSeverity": "string | undefined"
    }
  ],
  "metadata": {
    "createdAt": "string \u2014 ISO 8601",
    "updatedAt": "string \u2014 ISO 8601"
  }
}
\`\`\`

## Operations

### Read review state

Read the session JSON file to see all threads, their status, and messages.

### Create a new thread

Add an object to the \`threads\` array:

1. Generate a UUID v4 for the thread \`id\`
2. Set \`anchor\` with the file path, line number, side, and a preview of the line content
3. Compute \`anchor.hash\` as the first 16 characters of SHA-256 of the line content
4. Set \`status\` to \`"open"\`
5. Set \`severity\` to one of: \`critical\`, \`improvement\`, \`style\`, \`question\`
6. Add your message to \`messages\` with a new UUID, \`authorType: "agent"\`, your name, and the text
7. Set \`lastUpdatedAt\` to current ISO timestamp

### Reply to a thread

Find the thread by \`id\` and append a message to its \`messages\` array:

1. Generate a UUID v4 for the message \`id\`
2. Set \`authorType: "agent"\` and \`author\` to your name
3. Set \`text\` with your reply (markdown supported)
4. Set \`createdAt\` to current ISO timestamp
5. Update the thread's \`lastUpdatedAt\`

### Resolve a thread

1. Read the thread's messages to understand the issue
2. If you can fix the code: apply the fix, then update the thread
3. Set \`status\` to \`"resolved"\`
4. Add a message explaining what you did
5. Optionally set \`resolvedByModel\` to your model name

### Mark a thread as won't fix

Set \`status\` to \`"wontfix"\` and add a message explaining why.

### Mark a thread as outdated

Set \`status\` to \`"outdated"\` \u2014 use when the code the thread references has changed
and the comment is no longer applicable.

### Set review verdict

Update the top-level \`verdict\` field to \`"changes_requested"\` or \`null\` (clear verdict).

## Rules

1. **Always** set \`authorType: "agent"\` on messages you create
2. **Always** generate proper UUID v4 values for new IDs
3. **Always** update \`lastUpdatedAt\` on threads you modify
4. **Always** update \`metadata.updatedAt\` when writing the session file
5. **Read-modify-write**: Read the full JSON, make changes, write it back. Do not partially overwrite.
6. **Be specific**: Reference file paths, line numbers, and code snippets in your messages
7. **Fix when clear**: If the fix is unambiguous, apply it to the code AND resolve the thread
8. **Ask when unclear**: If the issue is ambiguous, reply with a question instead of guessing
${openThreads.length > 0 ? `
## Open Threads Summary

${this._renderThreadSummary(openThreads)}` : ""}
`;
  }
  _renderThreadSummary(threads) {
    return threads.map((t) => {
      const lastMsg = t.messages[t.messages.length - 1];
      const preview = lastMsg ? `${lastMsg.author}: ${lastMsg.text.slice(0, 100)}${lastMsg.text.length > 100 ? "..." : ""}` : "(no messages)";
      return `### Thread \`${t.id.slice(0, 8)}\` \u2014 ${t.severity} [${t.status}]
- **File**: \`${t.anchor.path}\` line ${t.anchor.line} (${t.anchor.side} side)
- **Last message**: ${preview}`;
    }).join("\n\n");
  }
  _renderClaudeMd() {
    return `@AGENTS.md
`;
  }
};

// src/agentInvoker.ts
var vscode2 = __toESM(require("vscode"));
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var AGENTS = {
  claude: {
    command: "claude",
    buildArgs: (prompt) => ["-p", prompt]
  },
  gemini: {
    command: "gemini",
    buildArgs: (prompt) => ["-p", prompt]
  },
  codex: {
    command: "codex",
    buildArgs: (prompt) => [prompt]
  }
};
function writeResolvePrompt(workspaceRoot, sessionFilePath, session) {
  const openThreads = session.threads.filter((t) => t.status === "open");
  const threadDetails = openThreads.map(formatThread).join("\n\n");
  const prompt = `# Resolve Review Threads

Resolve the open code review threads for the \`${session.featureId}\` feature.

## Session File

\`${sessionFilePath}\`

Read this JSON file for the full review state. After resolving threads, write the updated JSON back.

## Instructions

For each open thread below:

1. Read the file referenced in the thread anchor
2. Understand the review comment and the surrounding code
3. **If the fix is clear**: apply the fix to the code, then set thread \`status\` to \`"resolved"\` and add a message explaining what you did
4. **If unclear**: reply to the thread with a question, keep status as \`"open"\`

## Rules

- Set \`authorType: "agent"\` and \`author\` to your model name on messages you create
- Generate UUID v4 for new message IDs
- Update \`lastUpdatedAt\` on each thread you modify
- Update \`metadata.updatedAt\` on the session
- Read \u2192 modify \u2192 write the full session JSON (don't partially overwrite)

## Open Threads (${openThreads.length})

${threadDetails}
`;
  const reviewDir = path4.join(workspaceRoot, ".review");
  fs3.mkdirSync(reviewDir, { recursive: true });
  const promptPath = path4.join(reviewDir, "resolve-prompt.md");
  fs3.writeFileSync(promptPath, prompt);
  return promptPath;
}
function formatThread(thread) {
  const msgs = thread.messages.map(
    (m) => `  ${m.authorType === "agent" ? "\u{1F916}" : "\u{1F464}"} ${m.author}: ${m.text}`
  ).join("\n");
  return `### Thread \`${thread.id.slice(0, 8)}\` \u2014 ${thread.severity}
- **File**: \`${thread.anchor.path}\` line ${thread.anchor.line} (${thread.anchor.side} side)
- **Preview**: \`${thread.anchor.preview || "(no preview)"}\`
- **Messages**:
${msgs}`;
}
async function resolveInExistingTerminal(sessionFilePath, session, workspaceRoot, outputChannel) {
  const openCount = session.threads.filter((t) => t.status === "open").length;
  if (openCount === 0) {
    void vscode2.window.showInformationMessage("No open threads to resolve.");
    return;
  }
  const promptPath = writeResolvePrompt(
    workspaceRoot,
    sessionFilePath,
    session
  );
  const terminals = vscode2.window.terminals;
  if (terminals.length === 0) {
    void vscode2.window.showWarningMessage(
      "No open terminals. Start your coding agent in a terminal first."
    );
    return;
  }
  let terminal;
  if (terminals.length === 1) {
    terminal = terminals[0];
  } else {
    const picked = await vscode2.window.showQuickPick(
      terminals.map((t) => ({ label: t.name, terminal: t })),
      { placeHolder: "Select the terminal running your coding agent" }
    );
    if (!picked) return;
    terminal = picked.terminal;
  }
  terminal.show();
  const shortPrompt = `Resolve ${openCount} open review thread(s). Read the instructions at: ${promptPath}`;
  terminal.sendText(shortPrompt);
  outputChannel.appendLine(
    `Sent resolve prompt to terminal "${terminal.name}" (${openCount} threads)`
  );
}
function resolveWithNewAgent(sessionFilePath, session, workspaceRoot, outputChannel) {
  const config = vscode2.workspace.getConfiguration("localReview");
  const agentName = config.get("codingAgent", "claude");
  const agentConfig = AGENTS[agentName];
  if (!agentConfig) {
    void vscode2.window.showErrorMessage(
      `Unknown coding agent: "${agentName}". Supported: ${Object.keys(AGENTS).join(", ")}`
    );
    return;
  }
  const openCount = session.threads.filter((t) => t.status === "open").length;
  if (openCount === 0) {
    void vscode2.window.showInformationMessage("No open threads to resolve.");
    return;
  }
  const promptPath = writeResolvePrompt(
    workspaceRoot,
    sessionFilePath,
    session
  );
  outputChannel.appendLine(
    `Resolving ${openCount} thread(s) with ${agentName} (new terminal)`
  );
  const terminalName = `Local Review: ${agentName}`;
  const terminal = vscode2.window.createTerminal({
    name: terminalName,
    cwd: workspaceRoot
  });
  terminal.show();
  const readPrompt = `Read and follow instructions in ${promptPath}`;
  const args = agentConfig.buildArgs(readPrompt);
  const cmd = `${agentConfig.command} ${args.map(shellEscape).join(" ")}`;
  terminal.sendText(cmd);
  void vscode2.window.showInformationMessage(
    `Resolving ${openCount} thread(s) with ${agentName}. Check the terminal.`
  );
}
function shellEscape(s) {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// src/statusBar.ts
var vscode3 = __toESM(require("vscode"));
var StatusBar = class {
  _item;
  _state = "no-feature";
  _threadCount = 0;
  _openThreadCount = 0;
  constructor() {
    this._item = vscode3.window.createStatusBarItem(
      vscode3.StatusBarAlignment.Left,
      100
    );
    this._item.show();
    this._update();
  }
  setReady(threadCount, openCount) {
    this._state = "ready";
    this._threadCount = threadCount;
    if (openCount !== void 0) {
      this._openThreadCount = openCount;
    }
    this._update();
  }
  setNoFeature() {
    this._state = "no-feature";
    this._update();
  }
  setNoSession() {
    this._state = "no-session";
    this._update();
  }
  updateThreadCount(count, openCount) {
    this._threadCount = count;
    if (openCount !== void 0) {
      this._openThreadCount = openCount;
    }
    if (this._state === "ready") {
      this._update();
    }
  }
  _update() {
    switch (this._state) {
      case "ready":
        if (this._openThreadCount > 0) {
          this._item.text = `$(sparkle) Local Review: ${this._openThreadCount} open \xB7 Resolve with AI`;
          this._item.tooltip = "Click to resolve open threads with your coding agent";
          this._item.command = "local-review.resolveWithAI";
          this._item.backgroundColor = new vscode3.ThemeColor(
            "statusBarItem.warningBackground"
          );
        } else if (this._threadCount > 0) {
          this._item.text = `$(check) Local Review: ${this._threadCount} threads \xB7 All resolved`;
          this._item.tooltip = "All review threads resolved";
          this._item.command = "local-review.refresh";
          this._item.backgroundColor = void 0;
        } else {
          this._item.text = "$(comment-discussion) Local Review";
          this._item.tooltip = "No review threads yet";
          this._item.command = "local-review.refresh";
          this._item.backgroundColor = void 0;
        }
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
var vscode5 = __toESM(require("vscode"));
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
var vscode4 = __toESM(require("vscode"));
var import_child_process3 = require("child_process");
var import_util3 = require("util");
var execFileAsync3 = (0, import_util3.promisify)(import_child_process3.execFile);
var BaseContentProvider = class {
  _onDidChange = new vscode4.EventEmitter();
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
      const { stdout } = await execFileAsync3(
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
      const { stdout } = await execFileAsync3(
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
    return vscode4.Uri.parse(`${SCHEME_BASE}:/${key}`);
  }
  invalidate(path6) {
    if (path6) {
      const key = path6.startsWith("/") ? path6.slice(1) : path6;
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
  _onDidUpdateThread = new vscode5.EventEmitter();
  /** Fires after a thread status change with the featureId. */
  onDidUpdateThread = this._onDidUpdateThread.event;
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
    this._controller = vscode5.comments.createCommentController(
      "local-review",
      "Local Review"
    );
    this._controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        if (document.uri.scheme === "file" || document.uri.scheme === SCHEME_BASE) {
          return [new vscode5.Range(0, 0, document.lineCount - 1, 0)];
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
    let existing;
    try {
      existing = await sessionStore.getSession(featureId);
    } catch (err) {
      throw new Error(
        `Cannot auto-create session: existing file is unreadable \u2014 ${String(err)}`
      );
    }
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
      vscode5.commands.registerCommand(
        "local-review.createComment",
        async (reply) => {
          const thread = reply.thread;
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode5.window.showWarningMessage(
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
            this._onDidUpdateThread.fire(featureId);
            outputChannel.appendLine(
              `Created thread ${sessionThread.id} on ${sessionThread.anchor.path}:${sessionThread.anchor.line}`
            );
          } catch (err) {
            outputChannel.appendLine(`Failed to create thread: ${String(err)}`);
            void vscode5.window.showErrorMessage(
              `Local Review: Failed to create comment \u2014 ${String(err)}`
            );
          }
        }
      ),
      // Reply to an existing thread
      vscode5.commands.registerCommand(
        "local-review.replyToComment",
        async (reply) => {
          const thread = reply.thread;
          const featureId = getFeatureId();
          if (!featureId) {
            void vscode5.window.showWarningMessage(
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
            this._onDidUpdateThread.fire(featureId);
            outputChannel.appendLine(`Replied to thread ${sessionId}`);
          } catch (err) {
            outputChannel.appendLine(`Failed to reply: ${String(err)}`);
            void vscode5.window.showErrorMessage(
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
      ({ command, status, label }) => vscode5.commands.registerCommand(command, async (arg) => {
        const featureId = getFeatureId();
        if (!featureId) return;
        let sessionId;
        let commentThread;
        if (arg && typeof arg === "object" && "kind" in arg && arg.kind === "thread") {
          sessionId = arg.thread.id;
        } else if (arg) {
          commentThread = arg;
          sessionId = this._threadMapper.getSessionId(commentThread);
        }
        if (!sessionId) return;
        const closed = status !== "open";
        try {
          await sessionStore.updateThread(featureId, sessionId, { status });
          if (commentThread) {
            commentThread.state = closed ? 1 : 0;
            commentThread.contextValue = closed ? "closed" : "open";
            commentThread.collapsibleState = closed ? vscode5.CommentThreadCollapsibleState.Collapsed : vscode5.CommentThreadCollapsibleState.Expanded;
            commentThread.label = _CommentManager._statusLabel(status);
          }
          this._onDidUpdateThread.fire(featureId);
          outputChannel.appendLine(`${label} thread ${sessionId}`);
        } catch (err) {
          outputChannel.appendLine(
            `Failed to set ${label.toLowerCase()}: ${String(err)}`
          );
          void vscode5.window.showErrorMessage(
            `Local Review: Failed to set ${label.toLowerCase()} \u2014 ${String(err)}`
          );
        }
      })
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
      relativePath = vscode5.workspace.asRelativePath(uri);
      side = "new";
    }
    const range = vsThread.range ?? new vscode5.Range(0, 0, 0, 0);
    const line = range.start.line + 1;
    const lineEnd = range.end.line + 1;
    const document = await vscode5.workspace.openTextDocument(uri);
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
      filePath = vscode5.Uri.parse(`${SCHEME_BASE}:/${threadPath}`);
    } else {
      filePath = vscode5.Uri.file(`${this._workspaceRoot}/${threadPath}`);
    }
    const startLine = threadLine - 1;
    const endLine = (threadLineEnd ?? threadLine) - 1;
    const range = new vscode5.Range(startLine, 0, endLine, 0);
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
    thread.collapsibleState = !isNonOpen || hasAgentReply ? vscode5.CommentThreadCollapsibleState.Expanded : vscode5.CommentThreadCollapsibleState.Collapsed;
    thread.state = isNonOpen ? 1 : 0;
    thread.contextValue = isNonOpen ? "closed" : "open";
    return thread;
  }
  _createComment(msg) {
    return {
      body: new vscode5.MarkdownString(msg.text),
      mode: vscode5.CommentMode.Preview,
      author: {
        name: msg.authorType === "agent" ? `\u{1F916} ${msg.author}` : msg.author
      },
      timestamp: new Date(msg.createdAt)
    };
  }
  dispose() {
    this._onDidUpdateThread.dispose();
    this._threadMapper.dispose();
    this._controller.dispose();
  }
};

// src/sessionWatcher.ts
var vscode6 = __toESM(require("vscode"));
var fs4 = __toESM(require("fs"));
var SessionWatcher = class {
  _watcher = null;
  _currentPath = null;
  _suppressUntil = 0;
  _outputChannel;
  _onDidSessionChange = new vscode6.EventEmitter();
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
    const pattern = new vscode6.RelativePattern(
      vscode6.Uri.file(sessionFilePath).with({
        path: vscode6.Uri.file(sessionFilePath).path.split("/").slice(0, -1).join("/")
      }),
      vscode6.Uri.file(sessionFilePath).path.split("/").pop()
    );
    this._watcher = vscode6.workspace.createFileSystemWatcher(pattern);
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
      const raw = fs4.readFileSync(this._currentPath, "utf-8");
      const session = JSON.parse(raw);
      if (!Array.isArray(session.threads)) {
        this._outputChannel.appendLine(
          "Session watcher: parsed session has no threads array \u2014 ignoring"
        );
        return;
      }
      this._outputChannel.appendLine(
        `Session watcher: external change detected \u2014 ${session.threads.length} threads`
      );
      this._onDidSessionChange.fire(session);
    } catch (err) {
      this._outputChannel.appendLine(
        `Session watcher: failed to read \u2014 ${String(err)}`
      );
      void vscode6.window.showWarningMessage(
        "Local Review: Session file could not be read. Your view may be out of date. Try refreshing."
      );
    }
  }
  dispose() {
    this.unwatch();
    this._onDidSessionChange.dispose();
  }
};

// src/diffPanelManager.ts
var vscode9 = __toESM(require("vscode"));

// src/changedFilesTree.ts
var vscode8 = __toESM(require("vscode"));

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
    let status = "M" /* Modified */;
    if (/^new file mode/m.test(block)) {
      status = "A" /* Added */;
    } else if (/^deleted file mode/m.test(block)) {
      status = "D" /* Deleted */;
    } else if (/^rename from /m.test(block)) {
      status = "R" /* Renamed */;
    }
    let additions = 0;
    let deletions = 0;
    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    entries.push({
      path: status === "D" /* Deleted */ ? oldPath : newPath,
      oldPath,
      newPath,
      status,
      additions,
      deletions
    });
  }
  return entries;
}

// src/fileDecorationProvider.ts
var vscode7 = __toESM(require("vscode"));
var SCHEME_REVIEW_FILE = "local-review-file";
var STATUS_DECORATIONS = {
  ["A" /* Added */]: {
    badge: "A",
    color: "gitDecoration.addedResourceForeground",
    tooltip: "Added"
  },
  ["D" /* Deleted */]: {
    badge: "D",
    color: "gitDecoration.deletedResourceForeground",
    tooltip: "Deleted"
  },
  ["M" /* Modified */]: {
    badge: "M",
    color: "gitDecoration.modifiedResourceForeground",
    tooltip: "Modified"
  },
  ["R" /* Renamed */]: {
    badge: "R",
    color: "gitDecoration.renamedResourceForeground",
    tooltip: "Renamed"
  }
};
function makeReviewFileUri(relativePath) {
  return vscode7.Uri.from({
    scheme: SCHEME_REVIEW_FILE,
    path: "/" + relativePath.replace(/^\/+/, "")
  });
}
var ReviewFileDecorationProvider = class {
  _onDidChange = new vscode7.EventEmitter();
  onDidChangeFileDecorations = this._onDidChange.event;
  _decorations = /* @__PURE__ */ new Map();
  _uris = [];
  setFiles(files) {
    this._decorations.clear();
    this._uris = [];
    for (const file of files) {
      const uri = makeReviewFileUri(file.path);
      const def = STATUS_DECORATIONS[file.status];
      const tooltip = file.status === "R" /* Renamed */ ? `Renamed: ${file.oldPath} \u2192 ${file.newPath}` : def.tooltip;
      this._decorations.set(
        uri.path,
        new vscode7.FileDecoration(
          def.badge,
          tooltip,
          new vscode7.ThemeColor(def.color)
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
var VALID_MODES = ["flat", "compact-tree"];
function parseFileViewMode(raw) {
  return typeof raw === "string" && VALID_MODES.includes(raw) ? raw : "flat";
}
function cycleMode(current) {
  return current === "flat" ? "compact-tree" : "flat";
}
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
  ["A" /* Added */]: "gitDecoration.addedResourceForeground",
  ["D" /* Deleted */]: "gitDecoration.deletedResourceForeground",
  ["M" /* Modified */]: "gitDecoration.modifiedResourceForeground",
  ["R" /* Renamed */]: "gitDecoration.renamedResourceForeground"
};
var STATUS_LABELS = {
  ["A" /* Added */]: "Added",
  ["D" /* Deleted */]: "Deleted",
  ["M" /* Modified */]: "Modified",
  ["R" /* Renamed */]: "Renamed"
};
function buildFolderTree(files) {
  if (files.length === 0) return [];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const folderMap = /* @__PURE__ */ new Map();
  const rootChildren = [];
  for (const file of sorted) {
    const segments = file.path.split("/");
    let parentChildren = rootChildren;
    for (let i = 0; i < segments.length - 1; i++) {
      const folderPath = segments.slice(0, i + 1).join("/");
      let folder = folderMap.get(folderPath);
      if (!folder) {
        folder = {
          kind: "folder",
          label: segments[i],
          folderPath,
          children: [],
          openThreads: 0
        };
        folderMap.set(folderPath, folder);
        parentChildren.push(folder);
      }
      parentChildren = folder.children;
    }
    parentChildren.push(file);
  }
  return rootChildren;
}
function compactFolders(nodes) {
  return nodes.map((node) => {
    if (node.kind === "file") return node;
    node.children = compactFolders(node.children);
    while (node.children.length === 1 && node.children[0].kind === "folder") {
      const child = node.children[0];
      node.label = node.label + "/" + child.label;
      node.folderPath = child.folderPath;
      node.children = child.children;
    }
    return node;
  });
}
function aggregateThreadCounts(nodes) {
  for (const node of nodes) {
    if (node.kind === "folder") {
      aggregateThreadCounts(node.children);
      node.openThreads = node.children.reduce(
        (sum, child) => sum + (child.openThreads ?? 0),
        0
      );
    }
  }
}
function buildParentMap(nodes, parent, map) {
  for (const node of nodes) {
    map.set(node, parent);
    if (node.kind === "folder") {
      buildParentMap(node.children, node, map);
    }
  }
}
function findFirstFile(nodes) {
  for (const node of nodes) {
    if (node.kind === "file") return node;
    if (node.kind === "folder") {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return void 0;
}
var ChangedFilesTreeProvider = class {
  _onDidChangeTreeData = new vscode8.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _mode = "flat";
  _files = [];
  _rootChildren = [];
  _parentMap = /* @__PURE__ */ new Map();
  get mode() {
    return this._mode;
  }
  setMode(mode) {
    if (this._mode === mode) return;
    this._mode = mode;
    this._rebuild();
  }
  setFiles(files) {
    this._files = files.map((f) => ({
      ...f,
      kind: "file",
      openThreads: 0
    }));
    this._rebuild();
  }
  updateThreadCounts(threads) {
    const counts = /* @__PURE__ */ new Map();
    for (const t of threads) {
      if (t.status !== "open") continue;
      const path6 = t.anchor?.path;
      if (path6) counts.set(path6, (counts.get(path6) ?? 0) + 1);
    }
    let changed = false;
    for (const file of this._files) {
      const count = (counts.get(file.path) ?? 0) + (file.oldPath !== file.path ? counts.get(file.oldPath) ?? 0 : 0);
      if (file.openThreads !== count) {
        file.openThreads = count;
        changed = true;
      }
    }
    if (!changed) return;
    if (this._mode !== "flat") {
      aggregateThreadCounts(this._rootChildren);
    }
    this._onDidChangeTreeData.fire();
  }
  get fileCount() {
    return this._files.length;
  }
  getFirstFile() {
    if (this._mode === "flat") return this._files[0];
    return findFirstFile(this._rootChildren);
  }
  // -----------------------------------------------------------------------
  // TreeDataProvider interface
  // -----------------------------------------------------------------------
  getTreeItem(element) {
    if (element.kind === "folder") {
      return this._getFolderTreeItem(element);
    }
    return this._getFileTreeItem(element);
  }
  getChildren(element) {
    if (!element) return this._rootChildren;
    if (element.kind === "folder") return element.children;
    return [];
  }
  getParent(element) {
    return this._parentMap.get(element);
  }
  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  _rebuild() {
    if (this._mode === "flat") {
      this._rootChildren = this._files;
    } else {
      this._rootChildren = compactFolders(buildFolderTree(this._files));
      aggregateThreadCounts(this._rootChildren);
    }
    this._parentMap.clear();
    buildParentMap(this._rootChildren, void 0, this._parentMap);
    this._onDidChangeTreeData.fire();
  }
  _getFolderTreeItem(folder) {
    const item = new vscode8.TreeItem(
      folder.label,
      vscode8.TreeItemCollapsibleState.Expanded
    );
    item.iconPath = vscode8.ThemeIcon.Folder;
    item.contextValue = "folder";
    if (folder.openThreads > 0) {
      item.description = `${folder.openThreads} comment${folder.openThreads > 1 ? "s" : ""}`;
    }
    item.tooltip = folder.folderPath;
    return item;
  }
  _getFileTreeItem(element) {
    const label = element.path.split("/").pop() ?? element.path;
    const item = new vscode8.TreeItem(
      label,
      vscode8.TreeItemCollapsibleState.None
    );
    item.resourceUri = makeReviewFileUri(element.path);
    const parts = [];
    if (this._mode === "flat" && element.path.includes("/")) {
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
    item.iconPath = new vscode8.ThemeIcon(
      getFileIcon(element.path),
      new vscode8.ThemeColor(STATUS_COLORS[element.status])
    );
    item.command = {
      command: "local-review.openDiffFile",
      title: "Open Diff",
      arguments: [element]
    };
    const statusLabel = STATUS_LABELS[element.status];
    const tooltipLines = [`${statusLabel}: ${element.path}`];
    if (element.status === "R" /* Renamed */) {
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
};

// src/gitDiff.ts
var import_child_process4 = require("child_process");
var import_util4 = require("util");
var execFileAsync4 = (0, import_util4.promisify)(import_child_process4.execFile);
async function gitExec(args, cwd) {
  try {
    const { stdout } = await execFileAsync4("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout;
  } catch (err) {
    const execErr = err;
    if (execErr.code === 1 && execErr.stdout !== void 0) {
      return execErr.stdout;
    }
    throw new Error(
      `git ${args[0]} failed (exit ${execErr.code ?? "unknown"}): ${execErr.stderr ?? String(err)}`
    );
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
  const prefixArgs = ["--src-prefix=a/", "--dst-prefix=b/"];
  const committedDiff = await gitExec(
    ["diff", ...prefixArgs, `${targetBranch}...HEAD`],
    workspaceRoot
  );
  const uncommittedDiff = await gitExec(
    ["diff", ...prefixArgs, "HEAD"],
    workspaceRoot
  );
  const allDiff = await gitExec(
    ["diff", ...prefixArgs, targetBranch],
    workspaceRoot
  );
  const untrackedRaw = await gitExec(
    ["ls-files", "--others", "--exclude-standard"],
    workspaceRoot
  );
  const untrackedFiles = untrackedRaw.trim().split("\n").filter((f) => f.length > 0);
  const untrackedDiff = untrackedFiles.map(
    (f) => `diff --git a/${f} b/${f}
new file mode 100644
--- /dev/null
+++ b/${f}`
  ).join("\n");
  const combinedDiff = untrackedDiff ? `${allDiff}
${untrackedDiff}` : allDiff;
  return {
    worktreePath: workspaceRoot,
    sourceBranch,
    targetBranch,
    committedDiff,
    uncommittedDiff,
    allDiff: combinedDiff
  };
}

// src/diffPanelManager.ts
function makeSchemeUri(scheme, relativePath) {
  return vscode9.Uri.from({ scheme, path: "/" + relativePath });
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
  _context;
  get treeProvider() {
    return this._treeProvider;
  }
  /** Look up a diff file entry by path (matches path, oldPath, or newPath) */
  getFileByPath(filePath) {
    return this._files.find(
      (f) => f.path === filePath || f.oldPath === filePath || f.newPath === filePath
    );
  }
  constructor(workspaceRoot, baseProvider, outputChannel, context) {
    this._workspaceRoot = workspaceRoot;
    this._baseProvider = baseProvider;
    this._outputChannel = outputChannel;
    this._context = context;
    this._treeProvider = new ChangedFilesTreeProvider();
    this._decorationProvider = new ReviewFileDecorationProvider();
    this._decorationDisposable = vscode9.window.registerFileDecorationProvider(
      this._decorationProvider
    );
    const savedMode = parseFileViewMode(
      context.workspaceState.get("fileViewMode")
    );
    this._treeProvider.setMode(savedMode);
    void vscode9.commands.executeCommand(
      "setContext",
      "local-review.fileViewMode",
      savedMode
    );
    this._treeView = vscode9.window.createTreeView("localReview.changedFiles", {
      treeDataProvider: this._treeProvider
    });
  }
  /** Toggle view mode: flat ↔ compact-tree. */
  toggleViewMode() {
    const nextMode = cycleMode(this._treeProvider.mode);
    this._treeProvider.setMode(nextMode);
    void this._context.workspaceState.update("fileViewMode", nextMode);
    void vscode9.commands.executeCommand(
      "setContext",
      "local-review.fileViewMode",
      nextMode
    );
    this._outputChannel.appendLine(`File view mode: ${nextMode}`);
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
      void vscode9.commands.executeCommand(
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
      void vscode9.window.showInformationMessage(
        "No changes found between main and working tree."
      );
      return;
    }
    const firstItem = this._treeProvider.getFirstFile();
    if (firstItem) {
      void this._treeView.reveal(firstItem, { focus: true });
      await this.openFile(firstItem);
    }
  }
  async openFile(file) {
    let oldUri;
    let newUri;
    switch (file.status) {
      case "D" /* Deleted */:
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = makeSchemeUri(SCHEME_EMPTY, file.oldPath);
        break;
      case "A" /* Added */:
        oldUri = makeSchemeUri(SCHEME_EMPTY, file.newPath);
        newUri = vscode9.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      case "R" /* Renamed */:
        oldUri = makeSchemeUri(SCHEME_BASE, file.oldPath);
        newUri = vscode9.Uri.file(`${this._workspaceRoot}/${file.newPath}`);
        break;
      default:
        oldUri = makeSchemeUri(SCHEME_BASE, file.path);
        newUri = vscode9.Uri.file(`${this._workspaceRoot}/${file.path}`);
    }
    const title = file.status === "R" /* Renamed */ ? `${file.oldPath} \u2192 ${file.newPath} (Review Diff)` : `${file.path} (Review Diff)`;
    await vscode9.commands.executeCommand("vscode.diff", oldUri, newUri, title);
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
    void vscode9.commands.executeCommand(
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
var vscode10 = __toESM(require("vscode"));
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
  _onDidChangeTreeData = new vscode10.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _threads = [];
  updateThreads(threads) {
    this._threads = threads;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    if (element.kind === "group") {
      const item2 = new vscode10.TreeItem(
        `${element.label} (${element.threads.length})`,
        element.threads.length > 0 ? vscode10.TreeItemCollapsibleState.Expanded : vscode10.TreeItemCollapsibleState.None
      );
      item2.iconPath = new vscode10.ThemeIcon(
        element.icon,
        new vscode10.ThemeColor(element.color)
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
    const item = new vscode10.TreeItem(
      `${fileName}:${line}`,
      vscode10.TreeItemCollapsibleState.None
    );
    item.description = preview;
    item.tooltip = `${filePath}:${line}
${preview}`;
    item.iconPath = new vscode10.ThemeIcon("comment");
    item.contextValue = t.status === "open" ? "thread-open" : "thread-closed";
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
var execFileAsync5 = (0, import_util5.promisify)(import_child_process5.execFile);
function activate(context) {
  const outputChannel = vscode11.window.createOutputChannel("Local Review");
  outputChannel.appendLine("Local Review extension activated");
  const workspaceRoot = vscode11.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found \u2014 going dormant");
    return;
  }
  const baseProvider = new BaseContentProvider(workspaceRoot);
  const emptyProvider = new EmptyContentProvider();
  context.subscriptions.push(
    vscode11.workspace.registerTextDocumentContentProvider(
      SCHEME_BASE,
      baseProvider
    ),
    vscode11.workspace.registerTextDocumentContentProvider(
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
    outputChannel,
    context
  );
  const skillGenerator = new SkillGenerator(workspaceRoot);
  const threadsTree = new ThreadsTreeProvider();
  const threadsTreeView = vscode11.window.createTreeView("localReview.threads", {
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
      const openCount = threads.filter((t) => t.status === "open").length;
      statusBar.updateThreadCount(threads.length, openCount);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    })
  );
  context.subscriptions.push(
    commentManager.onDidUpdateThread(async (featureId) => {
      const session = await sessionStore.getSession(featureId);
      if (!session) return;
      const threads = session.threads ?? [];
      const openCount = threads.filter((t) => t.status === "open").length;
      statusBar.updateThreadCount(threads.length, openCount);
      diffPanelManager.updateThreadCounts(threads);
      threadsTree.updateThreads(threads);
    })
  );
  const resolveWorkspace = async () => {
    setWorkspaceRoot(workspaceRoot);
    try {
      const { stdout } = await execFileAsync5(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: workspaceRoot }
      );
      const gitCommonDir = path5.resolve(workspaceRoot, stdout.trim());
      const repoName = path5.basename(path5.dirname(gitCommonDir));
      setWorkspaceName(repoName);
      outputChannel.appendLine(`Workspace resolved: ${repoName}`);
    } catch {
      const fallback = path5.basename(workspaceRoot);
      setWorkspaceName(fallback);
      outputChannel.appendLine(`Workspace fallback: ${fallback}`);
    }
  };
  const loadSession = async (featureId) => {
    try {
      let session = await sessionStore.getSession(featureId);
      if (!session) {
        const sourceBranch = `feature/${featureId}`;
        session = {
          featureId,
          worktreePath: workspaceRoot,
          sourceBranch,
          targetBranch: "main",
          verdict: null,
          threads: [],
          metadata: {
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        };
        sessionStore.saveSession(featureId, session);
        outputChannel.appendLine(
          `Auto-created review session for ${featureId}`
        );
      }
      const threads = session.threads ?? [];
      const openThreads = threads.filter(
        (t) => t.status === "open"
      ).length;
      commentManager.loadThreads(threads);
      statusBar.setReady(threads.length, openThreads);
      threadsTree.updateThreads(threads);
      outputChannel.appendLine(
        `Session loaded: ${threads.length} threads (${openThreads} open)`
      );
      sessionWatcher.watch(getSessionFilePath(featureId));
      await diffPanelManager.populate(featureId);
      diffPanelManager.updateThreadCounts(threads);
      try {
        const skillContext = await skillGenerator.buildContext(
          featureId,
          getSessionFilePath(featureId),
          session
        );
        await skillGenerator.generate(skillContext, session);
        outputChannel.appendLine(
          `Agent skill files generated in .review/`
        );
      } catch (skillErr) {
        outputChannel.appendLine(
          `Skill generation failed: ${skillErr instanceof Error ? skillErr.message : String(skillErr)}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(
        `Failed to load session for ${featureId}: ${msg}`
      );
      void vscode11.window.showErrorMessage(
        `Local Review: Failed to load review session \u2014 ${msg}`
      );
    }
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
    vscode11.commands.registerCommand("local-review.refresh", () => {
      outputChannel.appendLine("Refresh command invoked");
      void init();
    }),
    vscode11.commands.registerCommand("local-review.startReview", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode11.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first."
        );
        return;
      }
      const existing = await sessionStore.getSession(featureId);
      if (existing) {
        void vscode11.window.showInformationMessage(
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
        void vscode11.window.showInformationMessage(
          `Review session created for ${featureId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to create session: ${msg}`);
        void vscode11.window.showErrorMessage(
          `Failed to create review session: ${msg}`
        );
      }
    }),
    vscode11.commands.registerCommand("local-review.requestChanges", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode11.window.showWarningMessage("No active feature.");
        return;
      }
      outputChannel.appendLine(
        `Request Changes: setting verdict for ${featureId}`
      );
      try {
        await sessionStore.setVerdict(featureId, "changes_requested");
        void vscode11.window.showInformationMessage(
          "Verdict saved. Run /resolve in your Claude session to process threads."
        );
        outputChannel.appendLine("Verdict set to changes_requested");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Request Changes failed: ${msg}`);
        void vscode11.window.showErrorMessage(`Failed to set verdict: ${msg}`);
      }
    }),
    // Diff panel commands
    vscode11.commands.registerCommand("local-review.openDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) {
        void vscode11.window.showWarningMessage(
          "No feature branch detected. Switch to a feature/* branch first."
        );
        return;
      }
      try {
        await diffPanelManager.open(featureId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`openDiff failed: ${msg}`);
        void vscode11.window.showErrorMessage(
          `Local Review: Failed to open diff \u2014 ${msg}`
        );
      }
    }),
    vscode11.commands.registerCommand(
      "local-review.openDiffFile",
      async (file) => {
        if (file && typeof file === "object" && "path" in file) {
          await diffPanelManager.openFile(
            file
          );
        }
      }
    ),
    vscode11.commands.registerCommand(
      "local-review.goToThread",
      async (filePath, line) => {
        const fileRef = diffPanelManager.getFileByPath(filePath) ?? {
          path: filePath,
          oldPath: filePath,
          newPath: filePath,
          status: "M" /* Modified */
        };
        await diffPanelManager.openFile(fileRef);
        setTimeout(() => {
          const editor = vscode11.window.activeTextEditor;
          if (editor) {
            const pos = new vscode11.Position(Math.max(0, line - 1), 0);
            editor.revealRange(
              new vscode11.Range(pos, pos),
              vscode11.TextEditorRevealType.InCenter
            );
          }
        }, 300);
      }
    ),
    vscode11.commands.registerCommand("local-review.refreshDiff", async () => {
      const featureId = featureDetector.featureId;
      if (!featureId) return;
      try {
        await diffPanelManager.refresh(featureId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`refreshDiff failed: ${msg}`);
      }
    }),
    vscode11.commands.registerCommand("local-review.closeDiff", () => {
      diffPanelManager.close();
    }),
    // View mode toggle: flat ↔ compact-tree
    vscode11.commands.registerCommand("local-review.toggleFileViewMode", () => {
      diffPanelManager.toggleViewMode();
    }),
    // Resolve open threads with AI agent
    vscode11.commands.registerCommand(
      "local-review.resolveWithAI",
      async () => {
        const featureId = featureDetector.featureId;
        if (!featureId) {
          void vscode11.window.showWarningMessage(
            "No feature branch detected. Switch to a feature/* branch first."
          );
          return;
        }
        const session = await sessionStore.getSession(featureId);
        if (!session) {
          void vscode11.window.showWarningMessage(
            "No review session found. Start a review first."
          );
          return;
        }
        const choice = await vscode11.window.showQuickPick(
          [
            {
              label: "$(terminal) Send to existing terminal",
              description: "Send resolve prompt to an agent already running",
              mode: "existing"
            },
            {
              label: "$(add) Start new agent",
              description: "Spawn a new agent process to resolve threads",
              mode: "new"
            }
          ],
          { placeHolder: "How should the agent be invoked?" }
        );
        if (!choice) return;
        if (choice.mode === "existing") {
          await resolveInExistingTerminal(
            getSessionFilePath(featureId),
            session,
            workspaceRoot,
            outputChannel
          );
        } else {
          resolveWithNewAgent(
            getSessionFilePath(featureId),
            session,
            workspaceRoot,
            outputChannel
          );
        }
      }
    ),
    // Regenerate agent skill files
    vscode11.commands.registerCommand(
      "local-review.regenerateSkills",
      async () => {
        const featureId = featureDetector.featureId;
        if (!featureId) {
          void vscode11.window.showWarningMessage(
            "No feature branch detected. Switch to a feature/* branch first."
          );
          return;
        }
        try {
          const session = await sessionStore.getSession(featureId);
          const skillContext = await skillGenerator.buildContext(
            featureId,
            getSessionFilePath(featureId),
            session
          );
          await skillGenerator.generate(skillContext, session);
          void vscode11.window.showInformationMessage(
            "Agent skill files regenerated in .review/"
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode11.window.showErrorMessage(
            `Failed to regenerate skills: ${msg}`
          );
        }
      }
    )
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
