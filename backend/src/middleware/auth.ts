import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { ERROR_CODES } from '@playlocal/shared';
import { env } from '../config/env';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/token';

function extractToken(req: Request): string | undefined {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.[env.COOKIE_NAME];
  return cookie || undefined;
}

/**
 * Resolves the user from the token. Role and status always come from the DB —
 * never from the token or the client — so blocking/demoting takes effect immediately.
 */
async function resolveUser(req: Request): Promise<Express.AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !Types.ObjectId.isValid(payload.sub)) return null;
  const user = await User.findById(payload.sub).select('_id name role status').lean();
  if (!user) return null;
  if (user.status === 'blocked') {
    throw ApiError.forbidden(
      'Your account has been blocked. Contact support.',
      ERROR_CODES.ACCOUNT_BLOCKED,
    );
  }
  return { id: user._id.toString(), _id: user._id, role: user.role, name: user.name };
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthenticated();
  req.user = user;
  next();
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.user = (await resolveUser(req)) ?? undefined;
  } catch {
    req.user = undefined;
  }
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw ApiError.unauthenticated();
  if (req.user.role !== 'admin') throw ApiError.forbidden('Admin access required.');
  next();
};

export function authUser(req: Request): Express.AuthUser {
  if (!req.user) throw ApiError.unauthenticated();
  return req.user;
}
