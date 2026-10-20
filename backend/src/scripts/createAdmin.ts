/**
 * Creates (or promotes) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * Admins can only be created this way — the API never accepts a role from the client.
 *   npm run create-admin
 */
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models';
import { hashPassword } from '../services/authService';

export async function ensureAdmin(): Promise<'created' | 'promoted' | 'exists' | 'skipped'> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return 'skipped';
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const existing = await User.findOne({ email }).lean();
  if (existing?.role === 'admin') return 'exists';
  if (existing) {
    await User.updateOne({ _id: existing._id }, { $set: { role: 'admin', status: 'active' } });
    return 'promoted';
  }
  await User.create({
    name: env.ADMIN_NAME,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
  });
  return 'created';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDb();
  const result = await ensureAdmin();

  console.log(
    result === 'skipped'
      ? 'ADMIN_EMAIL / ADMIN_PASSWORD not set — nothing to do.'
      : `Admin ${result}: ${env.ADMIN_EMAIL}`,
  );
  await disconnectDb();
}
