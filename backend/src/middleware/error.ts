import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ERROR_CODES, type ApiErrorBody } from '@playlocal/shared';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
};

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return new ApiError(413, ERROR_CODES.FILE_TOO_LARGE, 'Image is too large.');
    return ApiError.badRequest('Invalid file upload.', ERROR_CODES.INVALID_FILE);
  }
  if (err instanceof mongoose.Error.CastError) return ApiError.badRequest(`Invalid ${err.path}.`);
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.badRequest(
      errors[0]?.message ?? 'Invalid data.',
      ERROR_CODES.VALIDATION_ERROR,
      errors,
    );
  }
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    return ApiError.conflict('This record already exists.');
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    return ApiError.badRequest('Malformed JSON body.');
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    return new ApiError(413, ERROR_CODES.VALIDATION_ERROR, 'Request body is too large.');
  }
  // http-errors style (e.g. serve-static 404s): keep their 4xx status.
  const status =
    (err as { status?: number; statusCode?: number } | null)?.status ??
    (err as { statusCode?: number } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return status === 404
      ? ApiError.notFound()
      : new ApiError(status, ERROR_CODES.VALIDATION_ERROR, 'Bad request.');
  }
  return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiErr = toApiError(err);
  if (apiErr.status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }
  const body: ApiErrorBody & { stack?: string } = {
    success: false,
    message: apiErr.message,
    code: apiErr.code,
    errors: apiErr.errors,
  };
  if (!isProd && apiErr.status >= 500 && err instanceof Error) body.stack = err.stack;
  res.status(apiErr.status).json(body);
};
