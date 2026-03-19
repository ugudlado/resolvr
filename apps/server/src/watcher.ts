import chokidar from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import type { FSWatcher } from "chokidar";
import { clearGitState, refreshGitState } from "./git.js";

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

/** Per-repo watcher instances. Keyed by absolute repo path. */
const gitWatchers = new Map<string, FSWatcher>();

/**
 * Start watching a repo's .git/ for changes.
 * Supports multiple repos — each gets its own watcher and debounce timer.
 * No-ops if a watcher already exists for the given repo.
 */
export function startGitWatcher(repoRoot: string): void {
  if (gitWatchers.has(repoRoot)) return; // already watching

  const gitDir = path.join(repoRoot, ".git");
  const watchPaths = [
    path.join(gitDir, "HEAD"),
    path.join(gitDir, "refs", "heads"),
    path.join(gitDir, "worktrees"),
  ];

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar
    .watch(watchPaths, { ignoreInitial: true, depth: 2 })
    .on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearGitState(repoRoot);
        void refreshGitState(repoRoot).then(() => {
          broadcast({ event: WS_EVENTS.FEATURES_UPDATED, data: {} });
        });
      }, 300);
    });

  gitWatchers.set(repoRoot, watcher);
}

/** Stop watching a specific repo. */
export function stopGitWatcher(repoRoot: string): void {
  const watcher = gitWatchers.get(repoRoot);
  if (watcher) {
    void watcher.close();
    gitWatchers.delete(repoRoot);
  }
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
