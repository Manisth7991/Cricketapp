import bcrypt from 'bcryptjs';
import {
  ERROR_CODES,
  isEmailLike,
  normalizePhone,
  type changePasswordSchema,
  type loginSchema,
  type updateProfileSchema,
} from '@playlocal/shared';
import type { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { toUserDTO } from './serializers';
import { assertOwnImages } from './storageService';

// Pre-computed hash so failed lookups cost the same as a real comparison (no user-enumeration timing leak).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

async function assertEmailFree(email: string | undefined, excludeId: string) {
  if (!email) return;
  if (await User.exists({ email, _id: { $ne: excludeId } })) {
    throw ApiError.conflict('An account with this email already exists.', ERROR_CODES.EMAIL_TAKEN);
  }
}

/** Password login is for the admin console only — regular users sign in with phone OTP. */
export async function adminLogin(input: z.output<typeof loginSchema>) {
  const identifier = input.identifier.trim();
  const filter = isEmailLike(identifier)
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) };
  const user = await User.findOne(filter).select('+passwordHash').lean();

  const valid = await bcrypt.compare(input.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) {
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Incorrect email/phone or password.');
  }
  if (user.status === 'blocked') {
    throw ApiError.forbidden(
      'Your account has been blocked. Contact support.',
      ERROR_CODES.ACCOUNT_BLOCKED,
    );
  }
  if (user.role !== 'admin') {
    throw ApiError.forbidden('This account does not have admin access.');
  }
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return toUserDTO(user);
}

export async function getUserById(id: string) {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.unauthenticated();
  return toUserDTO(user);
}

export async function updateProfile(userId: string, input: z.output<typeof updateProfileSchema>) {
  assertOwnImages({ profileImage: input.profileImage });
  await assertEmailFree(input.email, userId);
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  if (input.name !== undefined) $set.name = input.name;
  if (input.email !== undefined) $set.email = input.email;
  if (input.profileImage !== undefined) {
    if (input.profileImage) $set.profileImage = input.profileImage;
    else $unset.profileImage = '';
  }
  if (input.location) {
    $set['location.city'] = input.location.city;
    $set['location.state'] = input.location.state;
    if (input.location.country) $set['location.country'] = input.location.country;
  }
  const user = await User.findByIdAndUpdate(
    userId,
    {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!user) throw ApiError.notFound('User not found.');
  return toUserDTO(user);
}

export async function changePassword(userId: string, input: z.output<typeof changePasswordSchema>) {
  const user = await User.findById(userId).select('+passwordHash').lean();
  if (!user) throw ApiError.unauthenticated();
  if (!user.passwordHash)
    throw ApiError.badRequest('This account signs in with OTP and has no password.');
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid)
    throw ApiError.badRequest('Current password is incorrect.', ERROR_CODES.INVALID_CREDENTIALS, [
      { path: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  await User.updateOne(
    { _id: userId },
    { $set: { passwordHash: await hashPassword(input.newPassword) } },
  );
}
