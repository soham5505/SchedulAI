import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';
import { ERROR_CODES } from '@schedulai/config';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ErrorMiddleware');

export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: Record<string, unknown> | Array<unknown>;

  constructor(
    message: string,
    statusCode = 400,
    errorCode: string = ERROR_CODES.BAD_REQUEST,
    details?: Record<string, unknown> | Array<unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(`Error caught: ${err.message}`, err.stack);

  // 1. Handled custom ApiError
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.errorCode, err.statusCode, err.details);
  }

  // 2. Zod Validation Error (support cross-package instances)
  if (
    err instanceof ZodError ||
    err.name === 'ZodError' ||
    Array.isArray((err as unknown as { issues?: unknown[] }).issues) ||
    Array.isArray((err as unknown as { errors?: unknown[] }).errors)
  ) {
    const rawIssues =
      (err as unknown as { issues?: Array<{ path: Array<string | number>; message: string }> }).issues ||
      (err as unknown as { errors?: Array<{ path: Array<string | number>; message: string }> }).errors ||
      [];

    const formattedErrors = rawIssues.map((e) => ({
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message,
    }));

    return sendError(
      res,
      'Validation failed',
      ERROR_CODES.VALIDATION_ERROR,
      422,
      formattedErrors
    );
  }

  // 3. Mongoose Duplicate Key Error (code 11000)
  if ((err as { code?: number }).code === 11000) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    const field = keyValue ? Object.keys(keyValue)[0] : 'field';
    return sendError(
      res,
      `A record with this ${field} already exists.`,
      ERROR_CODES.CONFLICT,
      409,
      keyValue
    );
  }

  // 4. Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(
      res,
      'Invalid resource identifier format.',
      ERROR_CODES.BAD_REQUEST,
      400
    );
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token', ERROR_CODES.INVALID_TOKEN, 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token has expired', ERROR_CODES.TOKEN_EXPIRED, 401);
  }

  // 6. Generic Internal Server Error (hide internal details)
  return sendError(
    res,
    'Internal server error',
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    500
  );
}
