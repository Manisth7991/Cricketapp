import { env } from '../config/env';
import { logger } from '../config/logger';
import { User } from '../models';

/**
 * Admin access is a role stored on the user document. ADMIN_PHONES only *bootstraps* that role:
 * the listed Indian mobile numbers are made admins, everyone else stays a user. Admins sign in
 * through the same phone-OTP flow as everyone else — there is no password anywhere.
 */
const ADMIN_PHONE_SET = new Set(env.ADMIN_PHONES);

export function isAdminPhone(phone: string): boolean {
  return ADMIN_PHONE_SET.has(phone);
}

export interface AdminSyncResult {
  created: string[];
  promoted: string[];
  demoted: number;
}

/**
 * Makes the database match ADMIN_PHONES: creates missing admin accounts (they fill in their name
 * from Settings after the first login), promotes existing users and demotes admins that are no
 * longer listed. Idempotent — runs on every server start and from `npm run seed`.
 *
 * With an empty list (dev machine without the variable) nothing is touched, so a missing env
 * var can never silently strip every admin.
 */
export async function syncAdmins(): Promise<AdminSyncResult> {
  const phones = env.ADMIN_PHONES;
  const result: AdminSyncResult = { created: [], promoted: [], demoted: 0 };
  if (phones.length === 0) {
    logger.warn('ADMIN_PHONES is empty — admin roles left unchanged');
    return result;
  }

  for (const phone of phones) {
    const existing = await User.findOne({ phone }).select('role').lean();
    if (!existing) {
      await User.create({ name: env.ADMIN_NAME, phone, role: 'admin' });
      result.created.push(phone);
    } else if (existing.role !== 'admin') {
      await User.updateOne({ _id: existing._id }, { $set: { role: 'admin', status: 'active' } });
      result.promoted.push(phone);
    }
  }

  // `$nin` also matches documents without a phone (legacy email-only admins).
  const demoted = await User.updateMany(
    { role: 'admin', phone: { $nin: phones } },
    { $set: { role: 'user' } },
  );
  result.demoted = demoted.modifiedCount;

  // Legacy clean-up: password hashes from the old email+password admin login are never read again.
  // Raw collection call because the field is no longer part of the schema.
  await User.collection.updateMany(
    { passwordHash: { $exists: true } },
    { $unset: { passwordHash: '' } },
  );
  return result;
}
