import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { User } from '../src/models';
import { hashPassword } from '../src/services/authService';

let app: Express | undefined;
export function getApp(): Express {
  app ??= createApp();
  return app;
}

/** Supertest agent that keeps cookies and sends the CSRF header. */
export function agent() {
  const a = request.agent(getApp());
  return {
    get: (url: string) => a.get(url),
    post: (url: string, body?: object) =>
      a
        .post(url)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(body ?? {}),
    patch: (url: string, body?: object) =>
      a
        .patch(url)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(body ?? {}),
    put: (url: string, body?: object) =>
      a
        .put(url)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(body ?? {}),
    delete: (url: string) => a.delete(url).set('X-Requested-With', 'XMLHttpRequest'),
    raw: a,
  };
}
export type Agent = ReturnType<typeof agent>;

let seq = 0;

/** Unique valid Indian mobile per call (starts with 9, 10 digits). */
export function nextPhone(): string {
  seq += 1;
  return `9${String(Date.now() % 1e5).padStart(5, '0')}${String(seq).padStart(4, '0')}`.slice(
    0,
    10,
  );
}

/** Full OTP sign-up through the public API (console SMS provider returns `devCode` in tests). */
export async function signup(
  overrides: Partial<{ name: string; email: string; phone: string }> = {},
) {
  const a = agent();
  const phone = overrides.phone ?? nextPhone();
  const req = await a.post('/api/auth/otp/request', { phone });
  if (req.status !== 200)
    throw new Error(`otp request failed: ${req.status} ${JSON.stringify(req.body)}`);
  const ver = await a.post('/api/auth/otp/verify', { phone, code: req.body.data.devCode });
  if (ver.status !== 200 || ver.body.data.status !== 'new_user')
    throw new Error(`otp verify failed: ${JSON.stringify(ver.body)}`);
  const done = await a.post('/api/auth/otp/complete', {
    ticket: ver.body.data.ticket,
    name: overrides.name ?? `User ${seq}`,
    ...(overrides.email ? { email: overrides.email } : {}),
  });
  if (done.status !== 201)
    throw new Error(`signup failed: ${done.status} ${JSON.stringify(done.body)}`);
  return {
    agent: a,
    user: done.body.data.user as { id: string; name: string; phone: string },
    phone,
  };
}

export async function createAdminAgent() {
  const email = `admin${++seq}@test.dev`;
  await User.create({
    name: 'Admin',
    email,
    passwordHash: await hashPassword('Adm1nPass!'),
    role: 'admin',
  });
  const a = agent();
  const res = await a.post('/api/auth/admin/login', { identifier: email, password: 'Adm1nPass!' });
  if (res.status !== 200) throw new Error(`admin login failed: ${JSON.stringify(res.body)}`);
  return a;
}

/* ----------------------------------------------------------- domain fixtures */
import { Sport, Tournament } from '../src/models';
import { invalidateSports } from '../src/services/sportService';

export async function seedSports() {
  invalidateSports();
  await Sport.insertMany([
    { name: 'Cricket', slug: 'cricket', order: 1 },
    { name: 'Football', slug: 'football', order: 2 },
    { name: 'Kabaddi', slug: 'kabaddi', order: 3, active: true },
    { name: 'Polo', slug: 'polo', order: 9, active: false },
  ]);
}

export function isoInDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

export function tournamentInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Sikar Premier League',
    sport: 'cricket',
    description: 'A friendly 8-over tennis-ball cricket tournament for local village teams.',
    venue: {
      name: 'Govt School Ground',
      address: 'Station Road, Near Bus Stand',
      city: 'sikar',
      state: 'Rajasthan',
    },
    startDate: isoInDays(20),
    endDate: isoInDays(22),
    registrationDeadline: isoInDays(15),
    maxTeams: 8,
    allowWaitlist: true,
    entryFee: 500,
    prizeMoney: 21000,
    rules: ['8 overs per side', 'Tennis ball only'],
    ...overrides,
  };
}

/** Create + submit + publish via DB shortcut (admin flow is tested separately). */
export async function createPublishedTournament(a: Agent, overrides: Record<string, unknown> = {}) {
  const res = await a.post('/api/tournaments', tournamentInput(overrides));
  if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  const id = res.body.data.id as string;
  await Tournament.updateOne(
    { _id: id },
    { $set: { status: 'published', verifiedAt: new Date(), submittedAt: new Date() } },
  );
  return id;
}

export async function createTeam(a: Agent, overrides: Record<string, unknown> = {}) {
  const res = await a.post('/api/teams', {
    name: `Team ${++seq}`,
    sport: 'cricket',
    players: [{ name: 'Player One' }, { name: 'Player Two', phone: '9811111111' }],
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`team create failed: ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; name: string; players: { id: string; name: string }[] };
}
