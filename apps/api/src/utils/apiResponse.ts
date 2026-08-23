import { Response } from 'express';
import { ApiResponse, ApiErrorResponse, PaginationMeta } from '@schedulai/shared-types';

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message = 'Operation successful',
  meta?: PaginationMeta,
  statusCode = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data?: T,
  message = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, undefined, 201);
}

export function sendError(
  res: Response,
  message: string,
  errorCode: string,
  statusCode = 400,
  details?: Record<string, unknown> | Array<unknown>
): Response {
  const response: ApiErrorResponse = {
    success: false,
    message,
    errorCode,
    details,
  };
  return res.status(statusCode).json(response);
}
