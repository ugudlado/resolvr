/**
 * Development logger for UI
 * Provides structured console logging with colored output
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

// CSS styles for browser console
const styles = {
  debug: "color: #6b7280; font-weight: normal;",
  info: "color: #3b82f6; font-weight: normal;",
  warn: "color: #f59e0b; font-weight: bold;",
  error: "color: #ef4444; font-weight: bold;",
  label: "color: #8b5cf6; font-weight: bold;",
  dim: "color: #9ca3af; font-weight: normal;",
};

const levelEmoji: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
};

function formatTime(): string {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  // In production, only log warnings and errors
  if (!isDev && (level === "debug" || level === "info")) return;

  const time = formatTime();
  const emoji = levelEmoji[level];
  const style = styles[level];

  const prefix = `%c[${time}] %c[ui] %c${emoji} ${message}`;
  const prefixStyles = [styles.dim, styles.label, style];

  if (context && Object.keys(context).length > 0) {
    console.groupCollapsed(prefix, ...prefixStyles);
    console.log("Context:", context);
    console.groupEnd();
  } else {
    console.log(prefix, ...prefixStyles);
  }
}

function logError(message: string, error: unknown, context?: LogContext): void {
  const errorContext: LogContext = { ...context };

  if (error instanceof Error) {
    errorContext.name = error.name;
    errorContext.message = error.message;
    errorContext.stack = error.stack;
  } else {
    errorContext.error = String(error);
  }

  log("error", message, errorContext);

  // Also log the full error in development for stack traces
  if (isDev && error instanceof Error) {
    console.error(error);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
  info: (message: string, context?: LogContext) =>
    log("info", message, context),
  warn: (message: string, context?: LogContext) =>
    log("warn", message, context),
  error: (message: string, context?: LogContext) =>
    log("error", message, context),
  logError,

  /** Log API request/response */
  api: (method: string, url: string, status?: number, duration?: number) => {
    const statusEmoji = status
      ? status >= 500
        ? "🔴"
        : status >= 400
          ? "🟡"
          : "🟢"
      : "⏳";

    const durationStr = duration ? ` (${duration}ms)` : "";
    const statusStr = status ? ` ${status}` : "";

    log("info", `${statusEmoji} ${method} ${url}${statusStr}${durationStr}`);
  },
};
