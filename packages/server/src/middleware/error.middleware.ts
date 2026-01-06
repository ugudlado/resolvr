/**
 * Centralized error handling middleware
 * Catches all errors and logs them with full context in development
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, code?: string, details?: unknown) {
    return new ApiError(400, message, code ?? 'BAD_REQUEST', details);
  }

  static notFound(message: string, code?: string) {
    return new ApiError(404, message, code ?? 'NOT_FOUND');
  }

  static internal(message: string, code?: string) {
    return new ApiError(500, message, code ?? 'INTERNAL_ERROR');
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Global error handling middleware
 * Must be registered AFTER all routes
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Log the error
  logger.logError(`Error handling ${req.method} ${req.path}`, err, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });

  // Build error response
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: unknown = undefined;

  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code ?? 'API_ERROR';
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  } else if (err.name === 'SyntaxError') {
    statusCode = 400;
    code = 'PARSE_ERROR';
    message = 'Invalid JSON in request body';
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
      // Include stack trace in development only
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
  };

  res.status(statusCode).json(response);
};

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
