import chokidar from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import { refreshGitState } from "./git.js";

/** Well-known WebSocket event names shared between server and client. */
export const WS_EVENTS = {
  FEATURES_UPDATED: "review:features-updated",
  SESSION_UPDATED: "review:session-updated",
  RESOLVE_STARTED: "review:resolve-started",
  RESOLVE_THREAD_DONE: "review:resolve-thread-done",
  RESOLVE_COMPLETED: "review:resolve-completed",
  RESOLVE_FAILED: "review:resolve-failed",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export type WsEvent = {
  event: WsEventName;
  data: unknown;
};

export type Broadcaster = (event: WsEvent) => void;

let broadcaster: Broadcaster = () => {};

export function setBroadcaster(fn: Broadcaster): void {
  broadcaster = fn;
}

function broadcast(event: WsEvent): void {
  broadcaster(event);
}

export function startGitWatcher(repoRoot: string): void {
  const gitDir = path.join(repoRoot, ".git");
  const watchPaths = [
    path.join(gitDir, "HEAD"),
    path.join(gitDir, "refs", "heads"),
    path.join(gitDir, "worktrees"),
  ];

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  chokidar
    .watch(watchPaths, { ignoreInitial: true, depth: 2 })
    .on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshGitState(repoRoot).then(() => {
          broadcast({ event: WS_EVENTS.FEATURES_UPDATED, data: {} });
        });
      }, 300);
    });
}

export function startSessionWatcher(sessionsDir: string): void {
  chokidar
    .watch(sessionsDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    .on("change", (filePath: string) => {
      if (!filePath.endsWith(".json")) return;
      void (async () => {
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const session = JSON.parse(content) as unknown;
          const fileName = path.basename(filePath);
          broadcast({
            event: WS_EVENTS.SESSION_UPDATED,
            data: { fileName, session },
          });
        } catch {
          // File may be mid-write or invalid JSON — ignore
        }
      })();
    });
}
