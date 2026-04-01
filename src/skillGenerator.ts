import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { SessionData } from "./sessionStore";

const execFileAsync = promisify(execFile);

export interface SkillContext {
  repoName: string;
  featureId: string;
  sessionFilePath: string;
  sourceBranch: string;
  targetBranch: string;
  workspaceRoot: string;
  changedFiles: string[];
}

/**
 * Generates agent instruction files (.review/AGENTS.md and .review/CLAUDE.md)
 * that teach coding agents the review session protocol.
 *
 * Agents read these files to understand how to create, reply to, and resolve
 * review threads by reading/writing the session JSON file directly.
 */
export class SkillGenerator {
  private readonly _workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this._workspaceRoot = workspaceRoot;
  }

  /**
   * Generate agent skill files for the current review context.
   * Creates .review/AGENTS.md (universal) and .review/CLAUDE.md (Claude Code shim).
   */
  async generate(
    context: SkillContext,
    session: SessionData | null,
  ): Promise<void> {
    const reviewDir = path.join(this._workspaceRoot, ".review");
    fs.mkdirSync(reviewDir, { recursive: true });

    const agentsMd = this._renderAgentsMd(context, session);
    const claudeMd = this._renderClaudeMd();

    fs.writeFileSync(path.join(reviewDir, "AGENTS.md"), agentsMd);
    fs.writeFileSync(path.join(reviewDir, "CLAUDE.md"), claudeMd);
  }

  /**
   * Build a SkillContext from the current workspace state.
   */
  async buildContext(
    featureId: string,
    sessionFilePath: string,
    session: SessionData | null,
  ): Promise<SkillContext> {
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
      changedFiles,
    };
  }

  private async _getRepoName(): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--git-common-dir"],
        { cwd: this._workspaceRoot },
      );
      const gitCommonDir = path.resolve(this._workspaceRoot, stdout.trim());
      return path.basename(path.dirname(gitCommonDir));
    } catch {
      return path.basename(this._workspaceRoot);
    }
  }

  private async _getChangedFiles(targetBranch: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "--name-only", targetBranch],
        { cwd: this._workspaceRoot },
      );
      return stdout
        .trim()
        .split("\n")
        .filter((f) => f.length > 0);
    } catch {
      return [];
    }
  }

  private _renderAgentsMd(
    ctx: SkillContext,
    session: SessionData | null,
  ): string {
    const openThreads =
      session?.threads.filter((t) => t.status === "open") ?? [];
    const resolvedThreads =
      session?.threads.filter((t) => t.status === "resolved") ?? [];

    return `# Code Review — ${ctx.repoName}

You are participating in a code review for the \`${ctx.featureId}\` feature.
Your role is to review code changes, respond to review threads, and resolve issues.

## Current State

- **Feature**: \`${ctx.featureId}\`
- **Branch**: \`${ctx.sourceBranch}\` → \`${ctx.targetBranch}\`
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
  "featureId": "string — feature identifier",
  "worktreePath": "string — absolute path to workspace",
  "sourceBranch": "string — feature branch name",
  "targetBranch": "string — merge target (usually main)",
  "verdict": "null | 'approved' | 'changes_requested'",
  "threads": [
    {
      "id": "string — UUID v4",
      "anchor": {
        "type": "diff-line",
        "hash": "string — SHA-256 hash of line content (first 16 chars)",
        "path": "string — file path relative to repo root",
        "preview": "string — first 80 chars of the anchored line",
        "line": "number — 1-based line number",
        "lineEnd": "number | undefined — end line for multi-line anchors",
        "side": "'old' | 'new' — which side of the diff"
      },
      "status": "'open' | 'resolved' | 'wontfix' | 'outdated'",
      "severity": "'critical' | 'improvement' | 'style' | 'question'",
      "messages": [
        {
          "id": "string — UUID v4",
          "authorType": "'human' | 'agent'",
          "author": "string — display name",
          "text": "string — markdown content",
          "createdAt": "string — ISO 8601 timestamp"
        }
      ],
      "lastUpdatedAt": "string — ISO 8601 timestamp",
      "labels": "Record<string, string> | undefined",
      "resolvedByModel": "string | undefined — model that resolved this",
      "resolvedWithSeverity": "string | undefined"
    }
  ],
  "metadata": {
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601"
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

Set \`status\` to \`"outdated"\` — use when the code the thread references has changed
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
${openThreads.length > 0 ? `\n## Open Threads Summary\n\n${this._renderThreadSummary(openThreads)}` : ""}
`;
  }

  private _renderThreadSummary(threads: SessionData["threads"]): string {
    return threads
      .map((t) => {
        const lastMsg = t.messages[t.messages.length - 1];
        const preview = lastMsg
          ? `${lastMsg.author}: ${lastMsg.text.slice(0, 100)}${lastMsg.text.length > 100 ? "..." : ""}`
          : "(no messages)";
        return `### Thread \`${t.id.slice(0, 8)}\` — ${t.severity} [${t.status}]
- **File**: \`${t.anchor.path}\` line ${t.anchor.line} (${t.anchor.side} side)
- **Last message**: ${preview}`;
      })
      .join("\n\n");
  }

  private _renderClaudeMd(): string {
    return `@AGENTS.md
`;
  }
}
