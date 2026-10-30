import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { AppLogger } from '../config/logger.js';
import { sendFailure } from '../utils/responses.js';
import { ApiError } from '../utils/api-error.js';
export const createErrorHandler =
  (logger: AppLogger, production: boolean): ErrorRequestHandler =>
  (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof ZodError) {
      sendFailure(res, 400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
      return;
    }
    if (error instanceof ApiError) {
      sendFailure(res, error.status, error.code, error.message, error.details);
      return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      sendFailure(
        res,
        409,
        'DUPLICATE_RESOURCE',
        'A resource with that unique value already exists',
      );
      return;
    }
    logger.error({ err: error, requestId: req.requestId }, 'Unhandled request error');
    const message = production
      ? 'An unexpected error occurred'
      : error instanceof Error
        ? error.message
        : 'Unknown error';
    sendFailure(res, 500, 'INTERNAL_SERVER_ERROR', message);
  };
