import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env, isProd } from '../config/env';

interface TokenPayload {
  sub: string;
}

/** `typ` separates session tokens from signup tickets so neither can be used as the other. */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: 'session' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
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

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProd,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
  };
}

function expiresInMs(): number {
  const decoded = jwt.decode(signToken('000000000000000000000000')) as { exp: number; iat: number };
  return (decoded.exp - decoded.iat) * 1000;
}
const maxAge = expiresInMs();

export function setAuthCookie(res: Response, token: string) {
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions(), maxAge });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
}
