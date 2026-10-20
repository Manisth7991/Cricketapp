/**
 * Syncs admin accounts with ADMIN_PHONES (create / promote listed numbers, demote the rest).
 * The server does the same on every start — this is for running it by hand.
 *   npm run sync-admins
 */
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { syncAdmins } from '../services/adminAccounts';

await connectDb();
const r = await syncAdmins();
console.log(
  env.ADMIN_PHONES.length
    ? `Admins: ${env.ADMIN_PHONES.join(', ')} — created ${r.created.length}, promoted ${r.promoted.length}, demoted ${r.demoted}`
    : 'ADMIN_PHONES not set — nothing to do.',
);
await disconnectDb();
