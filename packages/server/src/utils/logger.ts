/**
 * Development logger with colored output
 * Provides structured logging for debugging across server processes
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
} as const;

const levelColors: Record<LogLevel, string> = {
  debug: colors.dim + colors.cyan,
  info: colors.green,
  warn: colors.yellow,
  error: colors.red + colors.bright,
};

const levelLabels: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

const isDev = process.env.NODE_ENV !== 'production';

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().split('T')[1].slice(0, 12); // HH:MM:SS.mmm
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return '';

  const formatted = Object.entries(context)
    .map(([key, value]) => {
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${colors.dim}${key}=${colors.reset}${stringValue}`;
    })
    .join(' ');

  return ` ${formatted}`;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  // In production, only log warnings and errors
  if (!isDev && (level === 'debug' || level === 'info')) return;

  const timestamp = formatTimestamp();
  const color = levelColors[level];
  const label = levelLabels[level];
  const prefix = `${colors.dim}[${timestamp}]${colors.reset} ${color}[${label}]${colors.reset}`;
  const contextStr = formatContext(context);

  const output = `${prefix} ${colors.cyan}[server]${colors.reset} ${message}${contextStr}`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

function logError(message: string, error: unknown, context?: LogContext): void {
  const errorContext: LogContext = { ...context };

  if (error instanceof Error) {
    errorContext.errorName = error.name;
    errorContext.errorMessage = error.message;

    // Log full stack trace in development
    if (isDev && error.stack) {
      log('error', message, errorContext);
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
      return;
    }
  } else {
    errorContext.error = String(error);
  }

  log('error', message, errorContext);
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  /** Log an error with stack trace in development */
  logError,

  /** Log HTTP request */
  request: (method: string, path: string, statusCode: number, duration: number) => {
    const statusColor =
      statusCode >= 500
        ? colors.red
        : statusCode >= 400
          ? colors.yellow
          : statusCode >= 300
            ? colors.cyan
            : colors.green;

    log('info', `${method} ${path} ${statusColor}${statusCode}${colors.reset} ${colors.dim}${duration}ms${colors.reset}`);
  },
};
