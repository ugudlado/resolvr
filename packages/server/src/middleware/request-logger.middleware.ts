/**
 * Request logging middleware
 * Logs all incoming requests with timing information
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Log incoming requests and response times
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log request body in development (excluding sensitive fields)
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = sanitizeBody(req.body);
    logger.debug(`Request body`, { body: sanitizedBody });
  }

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(req.method, req.path, res.statusCode, duration);
  });

  next();
};

/**
 * Remove sensitive fields from request body for logging
 */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
