import * as vscode from "vscode";
import WebSocket from "ws";

export interface WsEvent {
  event: string;
  data: unknown;
}

/**
 * WebSocket client for the local-review server with exponential-backoff
 * auto-reconnect. Designed as a VS Code Disposable so it is cleaned up
 * automatically when added to context.subscriptions.
 */
export class WsClient implements vscode.Disposable {
  private _ws: WebSocket | null = null;
  private _handlers = new Map<string, Set<(data: unknown) => void>>();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectDelay = 1000;
  private static readonly _maxReconnectDelay = 30_000;
  private _disposed = false;
  private _serverUrl: string;
  private _outputChannel: vscode.OutputChannel;

  private readonly _onDidConnect = new vscode.EventEmitter<void>();
  readonly onDidConnect = this._onDidConnect.event;

  private readonly _onDidDisconnect = new vscode.EventEmitter<void>();
  readonly onDidDisconnect = this._onDidDisconnect.event;

  get connected(): boolean {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  constructor(serverUrl: string, outputChannel: vscode.OutputChannel) {
    this._serverUrl = serverUrl;
    this._outputChannel = outputChannel;
  }

  connect(): void {
    if (this._disposed) return;
    this._cleanup();

    const wsUrl = this._serverUrl.replace(/^http/, "ws") + "/ws";
    this._outputChannel.appendLine(`WS connecting to ${wsUrl}`);

    try {
      this._ws = new WebSocket(wsUrl);

      this._ws.on("open", () => {
        this._outputChannel.appendLine("WS connected");
        this._reconnectDelay = 1000; // Reset backoff on successful connect
        this._onDidConnect.fire();
      });

      this._ws.on("message", (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString()) as WsEvent;
          const payload = event.data as Record<string, unknown> | undefined;
          this._outputChannel.appendLine(
            `[WS] ${event.event} fileName=${payload?.fileName ?? "?"} workspace=${payload?.workspaceName ?? "?"}`,
          );
          const handlers = this._handlers.get(event.event);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(event.data);
              } catch (err) {
                this._outputChannel.appendLine(
                  `WS handler error for '${event.event}': ${err}`,
                );
              }
            }
          }
        } catch (err) {
          this._outputChannel.appendLine(`WS message parse error: ${err}`);
        }
      });

      this._ws.on("close", () => {
        this._outputChannel.appendLine("WS disconnected");
        this._onDidDisconnect.fire();
        this._scheduleReconnect();
      });

      this._ws.on("error", (err: Error) => {
        this._outputChannel.appendLine(`WS error: ${err.message}`);
        // error event is always followed by a close event, which handles reconnect
      });
    } catch (err) {
      this._outputChannel.appendLine(`WS connection failed: ${err}`);
      this._scheduleReconnect();
    }
  }

  /**
   * Subscribe to a named WebSocket event. Returns a Disposable that removes
   * the subscription when disposed.
   */
  on(event: string, handler: (data: unknown) => void): vscode.Disposable {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    return new vscode.Disposable(() => {
      this._handlers.get(event)?.delete(handler);
    });
  }

  disconnect(): void {
    this._cleanup();
  }

  private _scheduleReconnect(): void {
    if (this._disposed) return;
    const delay = this._reconnectDelay;
    this._outputChannel.appendLine(`WS reconnecting in ${delay}ms...`);
    this._reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
    // Exponential backoff capped at max delay
    this._reconnectDelay = Math.min(
      this._reconnectDelay * 2,
      WsClient._maxReconnectDelay,
    );
  }

  private _cleanup(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.removeAllListeners();
      if (
        this._ws.readyState === WebSocket.OPEN ||
        this._ws.readyState === WebSocket.CONNECTING
      ) {
        this._ws.close();
      }
      this._ws = null;
    }
  }

  dispose(): void {
    this._disposed = true;
    this._cleanup();
    this._onDidConnect.dispose();
    this._onDidDisconnect.dispose();
  }
}
