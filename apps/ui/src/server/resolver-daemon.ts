/**
 * resolver-daemon.ts
 *
 * Manages a persistent Claude Agent SDK session for resolving review threads.
 * Cold-starts when the Vite server boots, then resumes the same session for
 * each resolve request — accumulating context across resolve cycles.
 *
 * Uses @anthropic-ai/claude-agent-sdk query() with `resume` for multi-turn.
 */

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import fs from "node:fs/promises";
import path from "node:path";

export type ResolveResult = {
  resolved: number;
  clarifications: number;
  fixes: string[];
};

type DaemonState = {
  sessionId: string | null;
  isResolving: boolean;
  pendingResolve: (() => Promise<void>) | null;
  pendingReject: ((reason: Error) => void) | null;
  cwd: string | null;
  lastError: { message: string; timestamp: string; code?: string } | null;
};

const state: DaemonState = {
  sessionId: null,
  isResolving: false,
  pendingResolve: null,
  pendingReject: null,
  cwd: null,
  lastError: null,
};

const SYSTEM_PROMPT = `You are the review resolver for the local-review Claude Code plugin.

When asked to resolve review threads, you will:
1. For code sessions: run bash scripts/review-context.sh <session-file> <threadId> to extract context per thread
2. For spec sessions: read the spec file directly and locate the anchored section
3. Reply to each thread with analysis, apply fixes when unambiguous, ask clarifying questions when needed
4. PATCH each result to the local API at http://localhost:37003`;

const SDK_TIMEOUT_MS = 120_000;

/** Build a clean env for spawning Claude CLI (strips nested-session guard). */
function cleanEnv(): Record<string, string | undefined> {
  const { CLAUDECODE, ...rest } = process.env;
  return rest;
}

/** Collect text from assistant messages in the SDK stream. */
function extractText(messages: SDKMessage[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if ("text" in block && typeof block.text === "string") {
          parts.push(block.text);
        }
      }
    }
  }
  const text = parts.join("\n");
  if (!text.trim()) {
    console.warn(
      "[resolver-daemon] Agent produced no text output — result parsing will return defaults",
    );
  }
  return text;
}

/** Drain an SDK query stream, collecting messages and session ID. */
async function drainQuery(
  q: ReturnType<typeof query>,
): Promise<{ messages: SDKMessage[]; sessionId: string | null }> {
  const messages: SDKMessage[] = [];
  let sessionId: string | null = null;
  for await (const msg of q) {
    messages.push(msg);
    if (msg.session_id) {
      sessionId = msg.session_id;
    }
  }
  return { messages, sessionId };
}

/** Wrap drainQuery with a timeout to prevent indefinite hangs. */
async function drainQueryWithTimeout(
  q: ReturnType<typeof query>,
  timeoutMs: number = SDK_TIMEOUT_MS,
): Promise<{ messages: SDKMessage[]; sessionId: string | null }> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`SDK query timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );
  return Promise.race([drainQuery(q), timeout]);
}

/**
 * Cold-starts a Claude Agent SDK session with the review resolver context.
 * Captures the session_id for future resume calls.
 * Non-blocking — call and forget; logs errors without throwing.
 */
export async function coldStart(cwd: string): Promise<void> {
  state.cwd = cwd;
  state.lastError = null;
  try {
    const q = query({
      prompt: `Your working directory is: ${cwd}\nAcknowledge you are ready to resolve review threads. Reply with just: ready`,
      options: {
        model: "claude-sonnet-4-6",
        systemPrompt: SYSTEM_PROMPT,
        tools: { type: "preset", preset: "claude_code" },
        cwd,
        env: cleanEnv(),
        settingSources: ["project"],
        allowedTools: ["Read", "Edit", "Grep", "Glob", "Bash"],
        permissionMode: "bypassPermissions",
        maxTurns: 1,
      },
    });

    const { sessionId } = await drainQueryWithTimeout(q);

    if (sessionId) {
      state.sessionId = sessionId;
      console.log(
        `[resolver-daemon] Cold-started. Session: ${state.sessionId}`,
      );
    } else {
      state.lastError = {
        message:
          "Cold-start completed but no session_id was returned. " +
          "Check that @anthropic-ai/claude-agent-sdk is properly configured.",
        timestamp: new Date().toISOString(),
      };
      console.error(`[resolver-daemon] ${state.lastError.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.lastError = {
      message: `Cold-start failed: ${message}`,
      timestamp: new Date().toISOString(),
    };
    console.error("[resolver-daemon] Cold-start failed:", err);
  }
}

/**
 * Builds the resolve prompt for a given session file and type.
 */
async function buildResolvePrompt(
  sessionFile: string,
  sessionType: "code" | "spec",
  featureId: string,
  cwd: string,
): Promise<string> {
  let openThreadCount = 0;
  try {
    const raw = await fs.readFile(sessionFile, "utf-8");
    const session = JSON.parse(raw) as {
      threads?: Array<{ status: string }>;
    };
    openThreadCount = (session.threads ?? []).filter(
      (t) => t.status === "open",
    ).length;
  } catch (err) {
    console.error(
      `[resolver-daemon] Failed to read session file for thread count: ${sessionFile}`,
      err,
    );
  }

  const relSessionFile = path.relative(cwd, sessionFile);

  if (sessionType === "code") {
    return `Resolve all ${String(openThreadCount)} open threads in the code review session.
Session file: ${relSessionFile}
Feature ID: ${featureId}
Session type: code

For each open thread:
1. Run: bash scripts/review-context.sh ${relSessionFile} <threadId>
2. Analyze the context and reviewer messages
3. Either apply the fix, reply with explanation, or ask a clarifying question
4. PATCH the result:
   curl -s -X PATCH http://localhost:37003/api/features/${featureId}/code-session/threads/<threadId> \\
     -H 'Content-Type: application/json' \\
     -d '{"status":"resolved","messages":[{"authorType":"agent","author":"claude","text":"<reply>","createdAt":"<ISO>"}]}'
   Use status "open" when asking a clarifying question instead of resolving.

Return JSON: {"resolved": <number>, "clarifications": <number>, "fixes": ["<file>", ...]}`;
  }

  return `Resolve all ${String(openThreadCount)} open threads in the spec review session.
Session file: ${relSessionFile}
Feature ID: ${featureId}
Session type: spec

For each open thread:
1. Read the session file to get the thread anchor (sectionPath, blockIndex)
2. Read the spec file to locate the anchored section and block
3. Either revise the spec, reply with explanation, or ask a clarifying question
4. PATCH the result:
   curl -s -X PATCH http://localhost:37003/api/features/${featureId}/spec-session/threads/<threadId> \\
     -H 'Content-Type: application/json' \\
     -d '{"status":"resolved","messages":[{"authorType":"agent","author":"claude","text":"<reply>","createdAt":"<ISO>"}]}'
   Use status "open" when asking a clarifying question instead of resolving.

Return JSON: {"resolved": <number>, "clarifications": <number>, "fixes": ["<file>", ...]}`;
}

/**
 * Parses a ResolveResult from the agent's text output.
 * Uses a targeted regex to find the last JSON object with expected keys.
 */
function parseResolveOutput(text: string): ResolveResult {
  const defaultResult: ResolveResult = {
    resolved: 0,
    clarifications: 0,
    fixes: [],
  };

  if (!text.trim()) {
    console.error(
      "[resolver-daemon] Agent returned empty output — cannot parse result",
    );
    return defaultResult;
  }

  try {
    // Find all JSON-like objects and try the last one first (most likely the result)
    const jsonMatches = text.match(
      /\{[^{}]*(?:"resolved"|"clarifications")[^{}]*\}/g,
    );
    if (jsonMatches && jsonMatches.length > 0) {
      const lastMatch = jsonMatches[jsonMatches.length - 1];
      const inner = JSON.parse(lastMatch) as Partial<ResolveResult>;
      return {
        resolved: inner.resolved ?? 0,
        clarifications: inner.clarifications ?? 0,
        fixes: inner.fixes ?? [],
      };
    }
    console.error(
      "[resolver-daemon] No JSON object with expected keys found in agent output. Raw (first 500 chars):",
      text.slice(0, 500),
    );
  } catch (err) {
    console.error("[resolver-daemon] Failed to parse agent JSON output:", err);
    console.error(
      "[resolver-daemon] Raw output (first 500 chars):",
      text.slice(0, 500),
    );
  }
  return defaultResult;
}

async function executeResolve(
  sessionFile: string,
  sessionType: "code" | "spec",
  featureId: string,
  cwd: string,
): Promise<ResolveResult> {
  // Retry cold-start if session is not initialized
  if (!state.sessionId && state.cwd) {
    console.log(
      "[resolver-daemon] Session not initialized, attempting cold-start retry...",
    );
    await coldStart(state.cwd);
  }

  if (!state.sessionId) {
    throw new Error(
      `Resolver daemon not initialized — ${state.lastError?.message ?? "cold-start may have failed"}`,
    );
  }

  const prompt = await buildResolvePrompt(
    sessionFile,
    sessionType,
    featureId,
    cwd,
  );

  // Resume the existing session for accumulated context
  const q = query({
    prompt,
    options: {
      model: "claude-sonnet-4-6",
      resume: state.sessionId,
      tools: { type: "preset", preset: "claude_code" },
      cwd,
      env: cleanEnv(),
      settingSources: ["project"],
      allowedTools: ["Read", "Edit", "Grep", "Glob", "Bash"],
      permissionMode: "bypassPermissions",
      maxTurns: 50,
    },
  });

  const { messages, sessionId } = await drainQueryWithTimeout(q);

  // Keep session_id current
  if (sessionId) {
    state.sessionId = sessionId;
  }

  return parseResolveOutput(extractText(messages));
}

/**
 * Resolves open threads in a session, serializing concurrent requests.
 * If a resolve is already running, the new request is queued (latest wins).
 * Superseded queued requests are rejected so their Promises don't leak.
 */
export async function resolve(
  sessionFile: string,
  sessionType: "code" | "spec",
  featureId: string,
  cwd: string,
): Promise<ResolveResult> {
  if (state.isResolving) {
    // Reject previously queued resolve if one exists (superseded)
    if (state.pendingReject) {
      state.pendingReject(new Error("Superseded by newer resolve request"));
    }
    return new Promise<ResolveResult>((resolvePromise, rejectPromise) => {
      state.pendingReject = rejectPromise;
      state.pendingResolve = async () => {
        try {
          resolvePromise(
            await executeResolve(sessionFile, sessionType, featureId, cwd),
          );
        } catch (err) {
          rejectPromise(err instanceof Error ? err : new Error(String(err)));
        }
      };
    });
  }

  state.isResolving = true;
  try {
    return await executeResolve(sessionFile, sessionType, featureId, cwd);
  } finally {
    state.isResolving = false;
    if (state.pendingResolve) {
      const next = state.pendingResolve;
      state.pendingResolve = null;
      state.pendingReject = null;
      void next();
    }
  }
}

export function getStatus(): {
  ready: boolean;
  resolving: boolean;
  sessionId: string | null;
  lastError: { message: string; timestamp: string; code?: string } | null;
} {
  return {
    ready: state.sessionId !== null,
    resolving: state.isResolving,
    sessionId: state.sessionId,
    lastError: state.lastError,
  };
}
