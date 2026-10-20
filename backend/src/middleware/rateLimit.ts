import { rateLimit, type Options } from 'express-rate-limit';
import { ERROR_CODES } from '@playlocal/shared';
import { env, isTest } from '../config/env';

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60_000;

function limiter(limit: number, message: string, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message, code: ERROR_CODES.RATE_LIMITED, errors: [] });
    },
    ...extra,
  });
}

export const globalLimiter = limiter(
  env.RATE_LIMIT_GLOBAL_MAX,
  'Too many requests. Please slow down.',
);
export const authLimiter = limiter(
  env.RATE_LIMIT_AUTH_MAX,
  'Too many attempts. Please try again later.',
  {
    skipSuccessfulRequests: true,
  },
);
export const reportLimiter = limiter(
  env.RATE_LIMIT_REPORT_MAX,
  'Too many reports. Please try again later.',
);
export const uploadLimiter = limiter(
  env.RATE_LIMIT_UPLOAD_MAX,
  'Too many uploads. Please try again later.',
);

/** Reverse geocoding proxies a third-party service — keep it tight. */
export const geoLimiter = limiter(30, 'Too many location lookups. Please try again later.');

/** Each OTP request costs an SMS — per-IP cap on top of the per-number caps in otpService. */
export const otpRequestLimiter = limiter(
  env.RATE_LIMIT_OTP_MAX,
  'Too many OTP requests. Please try again later.',
);
