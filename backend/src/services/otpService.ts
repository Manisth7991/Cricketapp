import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ERROR_CODES, OTP_LENGTH } from '@playlocal/shared';
import { env, isProd } from '../config/env';
import { logger } from '../config/logger';
import { OtpChallenge, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { signContactTicket, signSignupTicket, verifySignupTicket } from '../utils/token';
import { sendOtpSms } from './smsService';
import { verifyFirebasePhoneToken } from './firebaseAuth';
import { isAdminPhone } from './adminAccounts';
import { toUserDTO } from './serializers';

const HOUR_MS = 60 * 60_000;

function hashCode(phone: string, code: string): string {
  // Bound to the phone so a hash can never be replayed for another number.
  return createHmac('sha256', env.JWT_SECRET).update(`otp:${phone}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

function generateCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

function tooSoon(retryAfterSeconds: number) {
  return new ApiError(
    429,
    ERROR_CODES.OTP_COOLDOWN,
    `Please wait ${retryAfterSeconds}s before requesting another code.`,
    [{ path: 'retryAfter', message: String(retryAfterSeconds) }],
  );
}

export interface OtpRequestResult {
  expiresIn: number;
  resendIn: number;
  /** Only in development with SMS_PROVIDER=console — never in production. */
  devCode?: string;
}

/** Send a fresh OTP to an Indian mobile number (rate-limited per number and per IP). */
export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  if (env.SMS_PROVIDER === 'firebase') {
    throw ApiError.badRequest(
      'Phone verification runs through Firebase on this server.',
      ERROR_CODES.PHONE_AUTH_UNAVAILABLE,
    );
  }
  const blocked = await User.exists({ phone, status: 'blocked' });
  if (blocked)
    throw ApiError.forbidden(
      'This account has been blocked. Contact support.',
      ERROR_CODES.ACCOUNT_BLOCKED,
    );

  const now = new Date();
  const existing = await OtpChallenge.findOne({ phone }).lean();

  if (existing) {
    const since = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
    if (since < env.OTP_RESEND_COOLDOWN_SECONDS)
      throw tooSoon(Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - since));
  }

  const windowOpen = existing && now.getTime() - existing.windowStartedAt.getTime() < HOUR_MS;
  if (windowOpen && existing.sendsInWindow >= env.OTP_MAX_SENDS_PER_HOUR) {
    throw new ApiError(
      429,
      ERROR_CODES.OTP_SEND_LIMIT,
      'Too many codes requested for this number. Try again in an hour.',
    );
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + env.OTP_TTL_SECONDS * 1000);
  const windowStartedAt = windowOpen ? existing.windowStartedAt : now;
  const purgeAt = new Date(Math.max(expiresAt.getTime(), windowStartedAt.getTime() + HOUR_MS));
  const fields = {
    codeHash: hashCode(phone, code),
    expiresAt,
    attempts: 0,
    lastSentAt: now,
    windowStartedAt,
    sendsInWindow: windowOpen ? existing.sendsInWindow + 1 : 1,
    purgeAt,
  };

  // Optimistic concurrency: two simultaneous requests can't both pass the cooldown and send 2 SMS.
  if (existing) {
    const res = await OtpChallenge.updateOne(
      { _id: existing._id, lastSentAt: existing.lastSentAt },
      { $set: fields },
    );
    if (!res.modifiedCount) throw tooSoon(env.OTP_RESEND_COOLDOWN_SECONDS);
  } else {
    try {
      await OtpChallenge.create({ phone, ...fields });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw tooSoon(env.OTP_RESEND_COOLDOWN_SECONDS);
      throw err;
    }
  }

  try {
    await sendOtpSms(phone, code);
  } catch (err) {
    logger.error({ err: (err as Error).message, provider: env.SMS_PROVIDER }, 'OTP SMS failed');
    throw new ApiError(
      502,
      ERROR_CODES.OTP_SEND_FAILED,
      "We couldn't send the SMS right now. Please try again in a minute.",
    );
  }

  return {
    expiresIn: env.OTP_TTL_SECONDS,
    resendIn: env.OTP_RESEND_COOLDOWN_SECONDS,
    ...(env.SMS_PROVIDER === 'console' && !isProd ? { devCode: code } : {}),
  };
}

export type OtpVerifyResult =
  { status: 'logged_in'; userId: string } | { status: 'new_user'; ticket: string };

/** Check and burn the code for this phone (single use, attempt-limited). Throws on any failure. */
async function consumeOtp(phone: string, code: string): Promise<void> {
  const now = new Date();
  const challenge = await OtpChallenge.findOne({ phone }).lean();
  if (!challenge || !challenge.codeHash || challenge.expiresAt.getTime() <= now.getTime()) {
    throw ApiError.badRequest(
      'This code has expired. Request a new one.',
      ERROR_CODES.OTP_EXPIRED,
      [{ path: 'code', message: 'Code expired' }],
    );
  }

  // Count the attempt atomically *before* comparing, so parallel guesses can't exceed the limit.
  const counted = await OtpChallenge.findOneAndUpdate(
    { _id: challenge._id, codeHash: challenge.codeHash, attempts: { $lt: env.OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ).lean();
  if (!counted) {
    await OtpChallenge.updateOne(
      { _id: challenge._id },
      { $set: { codeHash: '', expiresAt: now } },
    );
    throw new ApiError(
      429,
      ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
      'Too many wrong attempts. Request a new code.',
    );
  }

  if (!sameHash(counted.codeHash, hashCode(phone, code))) {
    const left = env.OTP_MAX_ATTEMPTS - counted.attempts;
    if (left <= 0) {
      await OtpChallenge.updateOne(
        { _id: challenge._id },
        { $set: { codeHash: '', expiresAt: now } },
      );
      throw new ApiError(
        429,
        ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
        'Too many wrong attempts. Request a new code.',
      );
    }
    throw ApiError.badRequest(
      `Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
      ERROR_CODES.OTP_INVALID,
      [{ path: 'code', message: 'Incorrect code' }],
    );
  }

  // Single use: burn the code (doc stays until purgeAt so the hourly cap keeps working).
  await OtpChallenge.updateOne(
    { _id: challenge._id, codeHash: counted.codeHash },
    { $set: { codeHash: '', expiresAt: now } },
  );
}

/** Check the code. Existing number → logged in. New number → short-lived signup ticket. */
export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  await consumeOtp(phone, code);
  return resolvePhoneLogin(phone);
}

/** A phone number has just been proven (our OTP or Firebase): log in, or hand out a signup ticket. */
async function resolvePhoneLogin(phone: string): Promise<OtpVerifyResult> {
  const now = new Date();
  const user = await User.findOne({ phone }).select('_id status phoneVerifiedAt').lean();
  if (!user) return { status: 'new_user', ticket: signSignupTicket(phone) };
  if (user.status === 'blocked')
    throw ApiError.forbidden(
      'This account has been blocked. Contact support.',
      ERROR_CODES.ACCOUNT_BLOCKED,
    );
  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: now, ...(user.phoneVerifiedAt ? {} : { phoneVerifiedAt: now }) } },
  );
  return { status: 'logged_in', userId: user._id.toString() };
}

/**
 * Logged-in organisers verifying a WhatsApp number that is not their login number. No login
 * side effects — returns a short-lived ticket that create/update tournament accepts as proof.
 */
export async function verifyContactOtp(userId: string, phone: string, code: string) {
  await consumeOtp(phone, code);
  return { ticket: signContactTicket(userId, phone), phone };
}

/** New numbers: create the account from a verified-phone ticket + name (+ optional email). */
export async function completeSignup(input: { ticket: string; name: string; email?: string }) {
  const phone = verifySignupTicket(input.ticket);
  if (!phone) {
    throw new ApiError(
      401,
      ERROR_CODES.SIGNUP_TICKET_INVALID,
      'Your verification expired. Please verify your number again.',
    );
  }

  // Double-submit / race: the account may already exist → just sign in.
  const existing = await User.findOne({ phone }).lean();
  if (existing) {
    if (existing.status === 'blocked')
      throw ApiError.forbidden(
        'This account has been blocked. Contact support.',
        ERROR_CODES.ACCOUNT_BLOCKED,
      );
    return toUserDTO(existing);
  }
  if (input.email && (await User.exists({ email: input.email }))) {
    throw ApiError.conflict('An account with this email already exists.', ERROR_CODES.EMAIL_TAKEN);
  }

  try {
    const user = await User.create({
      name: input.name,
      phone,
      email: input.email,
      phoneVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      // Never taken from client input: only numbers listed in ADMIN_PHONES become admins.
      role: isAdminPhone(phone) ? 'admin' : 'user',
    });
    return toUserDTO(user.toObject());
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const again = await User.findOne({ phone }).lean();
      if (again) return toUserDTO(again);
      throw ApiError.conflict(
        'An account with this email already exists.',
        ERROR_CODES.EMAIL_TAKEN,
      );
    }
    throw err;
  }
}

/* ------------------------------------------------------------ Firebase Phone Auth */

/** Login / sign-up with a Firebase ID token (the browser already sent and confirmed the SMS). */
export async function firebaseLogin(idToken: string): Promise<OtpVerifyResult> {
  return resolvePhoneLogin(await verifyFirebasePhoneToken(idToken));
}

/** Organiser proving a different WhatsApp number through Firebase → contact ticket. */
export async function firebaseContact(userId: string, idToken: string) {
  const phone = await verifyFirebasePhoneToken(idToken);
  return { ticket: signContactTicket(userId, phone), phone };
}
