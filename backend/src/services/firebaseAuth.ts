import jwt from 'jsonwebtoken';
import { ERROR_CODES, normalizePhone } from '@playlocal/shared';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

/**
 * Verifies Firebase Phone Authentication ID tokens without the firebase-admin SDK: they are
 * ordinary RS256 JWTs signed by Google. We fetch Google's public certificates (cached per their
 * Cache-Control header), check signature / audience / issuer, and require a *fresh* phone sign-in.
 * Docs: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
/** A token proves a login that happened at most this long ago (limits replay of a leaked token). */
const MAX_AUTH_AGE_SECONDS = 10 * 60;

let certs: Record<string, string> = {};
let certsExpireAt = 0;

async function getCert(kid: string): Promise<string | undefined> {
  if (Date.now() > certsExpireAt || !certs[kid]) {
    const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Google certs ${res.status}`);
    certs = (await res.json()) as Record<string, string>;
    const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
    certsExpireAt = Date.now() + (maxAge ? Number(maxAge) : 3600) * 1000;
  }
  return certs[kid];
}

/** Returns the 10-digit Indian mobile number a Firebase phone ID token proves, or throws. */
export async function verifyFirebasePhoneToken(idToken: string): Promise<string> {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (env.SMS_PROVIDER !== 'firebase' || !projectId) {
    throw ApiError.badRequest(
      'Firebase sign-in is not enabled on this server.',
      ERROR_CODES.PHONE_AUTH_UNAVAILABLE,
    );
  }
  const invalid = () =>
    new ApiError(401, ERROR_CODES.OTP_INVALID, 'Phone verification failed. Please try again.');

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header.kid;
  if (!kid || decoded.header.alg !== 'RS256') throw invalid();

  let cert: string | undefined;
  try {
    cert = await getCert(kid);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Could not fetch Firebase signing certs');
    throw new ApiError(
      502,
      ERROR_CODES.OTP_SEND_FAILED,
      "We couldn't verify the code right now. Please try again in a minute.",
    );
  }
  if (!cert) throw invalid();

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }) as jwt.JwtPayload;
  } catch {
    throw invalid();
  }

  const provider = (payload.firebase as { sign_in_provider?: string } | undefined)
    ?.sign_in_provider;
  if (!payload.sub || provider !== 'phone' || typeof payload.phone_number !== 'string')
    throw invalid();

  const authTime = Number(payload.auth_time);
  if (!authTime || Date.now() / 1000 - authTime > MAX_AUTH_AGE_SECONDS) {
    throw new ApiError(
      400,
      ERROR_CODES.OTP_EXPIRED,
      'This verification has expired. Request a new code.',
    );
  }

  const phone = normalizePhone(payload.phone_number);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw ApiError.badRequest(
      'Only Indian mobile numbers are supported.',
      ERROR_CODES.VALIDATION_ERROR,
      [{ path: 'phone', message: 'Enter a valid 10-digit Indian mobile number' }],
    );
  }
  return phone;
}
