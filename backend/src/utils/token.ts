import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import type { UserRole } from '@playlocal/shared';
import { env, isProd } from '../config/env';

interface TokenPayload {
  sub: string;
}

/**
 * `typ` separates session tokens from signup tickets so neither can be used as the other.
 * Admin sessions are shorter (ADMIN_JWT_EXPIRES_IN) — the role itself is always re-read from the DB.
 */
export function signToken(userId: string, role: UserRole = 'user'): string {
  const expiresIn = role === 'admin' ? env.ADMIN_JWT_EXPIRES_IN : env.JWT_EXPIRES_IN;
  return jwt.sign({ sub: userId, typ: 'session' }, env.JWT_SECRET, {
    expiresIn: expiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && payload.typ === 'session' && typeof payload.sub === 'string')
      return { sub: payload.sub };
    return null;
  } catch {
    return null;
  }
}

/** Proof that a phone number was just verified by OTP — lets a new user finish signing up. */
export function signSignupTicket(phone: string): string {
  return jwt.sign({ phone, typ: 'signup' }, env.JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

export function verifySignupTicket(ticket: string): string | null {
  try {
    const payload = jwt.verify(ticket, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (
      typeof payload === 'object' &&
      payload.typ === 'signup' &&
      typeof payload.phone === 'string'
    )
      return payload.phone;
    return null;
  } catch {
    return null;
  }
}

/**
 * Proof that a logged-in user just OTP-verified a WhatsApp number other than their login number.
 * Bound to the user so it can't be handed to someone else.
 */
export function signContactTicket(userId: string, phone: string): string {
  return jwt.sign({ sub: userId, phone, typ: 'contact' }, env.JWT_SECRET, {
    expiresIn: '30m',
    algorithm: 'HS256',
  });
}

export function verifyContactTicket(ticket: string, userId: string): string | null {
  try {
    const payload = jwt.verify(ticket, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (
      typeof payload === 'object' &&
      payload.typ === 'contact' &&
      payload.sub === userId &&
      typeof payload.phone === 'string'
    )
      return payload.phone;
    return null;
  } catch {
    return null;
  }
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProd,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
  };
}

/** Cookie lifetime always equals the token lifetime (user or admin). */
export function setAuthCookie(res: Response, token: string) {
  const { exp, iat } = jwt.decode(token) as { exp: number; iat: number };
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions(), maxAge: (exp - iat) * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
}
