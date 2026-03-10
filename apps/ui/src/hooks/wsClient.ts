/**
 * wsClient.ts
 *
 * Singleton WebSocket client that connects to the standalone review server.
 * Replaces `import.meta.hot` event subscriptions used in the Vite dev server era.
 *
 * The server sends JSON messages shaped as: { event: string; data: unknown }
 */

type WsMessage = { event: string; data: unknown };
type WsHandler = (data: unknown) => void;

const handlers = new Map<string, Set<WsHandler>>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

/** Total number of active handler subscriptions. */
function totalHandlerCount(): number {
  let count = 0;
  for (const set of handlers.values()) count += set.size;
  return count;
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

function connect(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.addEventListener("message", (ev: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(ev.data) as WsMessage;
      const subs = handlers.get(msg.event);
      if (subs) {
        for (const handler of subs) {
          try {
            handler(msg.data);
          } catch {
            // Never let a subscriber crash the connection
          }
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    ws = null;
    // Only reconnect if there are active subscribers
    if (totalHandlerCount() > 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    }
  });

  ws.addEventListener("error", () => {
    ws?.close();
  });
}

/** Subscribe to a WebSocket event by name. Returns an unsubscribe function. */
export function wsOn(event: string, handler: WsHandler): () => void {
  if (!handlers.has(event)) {
    handlers.set(event, new Set());
  }
  handlers.get(event)?.add(handler);

  // Ensure connected
  connect();

  return () => {
    const set = handlers.get(event);
    if (set) {
      set.delete(handler);
      // Clean up empty sets
      if (set.size === 0) handlers.delete(event);
    }
    // Disconnect when no subscribers remain
    if (totalHandlerCount() === 0) {
      disconnect();
    }
  };
}
