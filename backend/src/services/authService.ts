import { ERROR_CODES, type updateProfileSchema } from '@playlocal/shared';
import type { z } from 'zod';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { toUserDTO } from './serializers';
import { assertOwnImages } from './storageService';

async function assertEmailFree(email: string | undefined, excludeId: string) {
  if (!email) return;
  if (await User.exists({ email, _id: { $ne: excludeId } })) {
    throw ApiError.conflict('An account with this email already exists.', ERROR_CODES.EMAIL_TAKEN);
  }
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
