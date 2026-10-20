import { ERROR_CODES, type ErrorCode, type FieldError } from '@playlocal/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(
    message: string,
    code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
    errors: FieldError[] = [],
  ) {
    return new ApiError(400, code, message, errors);
  }
  static unauthenticated(message = 'Please log in to continue.') {
    return new ApiError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }
  static forbidden(
    message = 'You do not have permission to do this.',
    code: ErrorCode = ERROR_CODES.FORBIDDEN,
  ) {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
  }
  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new ApiError(409, code, message);
  }
}
