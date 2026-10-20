import type { RequestHandler } from 'express';
import { ERROR_CODES } from '@playlocal/shared';
import { ApiError } from '../utils/ApiError';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests: every state-changing request must
 * carry `X-Requested-With: XMLHttpRequest` (or a Bearer token). Browsers can't add a
 * custom header cross-origin without a CORS preflight, which our CORS policy only
 * allows for configured CLIENT_ORIGINS.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  if (req.get('x-requested-with') === 'XMLHttpRequest') return next();
  if (req.get('authorization')?.startsWith('Bearer ')) return next();
  next(new ApiError(403, ERROR_CODES.CSRF_REJECTED, 'Request rejected.'));
};
