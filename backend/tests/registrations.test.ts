import { beforeEach, describe, expect, it } from 'vitest';
import { Notification, Tournament } from '../src/models';
import {
  createAdminAgent,
  createPublishedTournament,
  createTeam,
  seedSports,
  signup,
  tournamentInput,
} from './helpers';

beforeEach(seedSports);

async function setup(overrides: Record<string, unknown> = {}) {
  const organiser = await signup({ name: 'Organiser' });
  const { maxTeams, ...rest } = overrides as { maxTeams?: number };
  const tid = await createPublishedTournament(organiser.agent, {
    ...rest,
    maxTeams: Math.max(2, maxTeams ?? 8),
  });
  // Capacity of 1 is below the API minimum — set directly to exercise edge cases.
  if (maxTeams === 1) await Tournament.updateOne({ _id: tid }, { maxTeams: 1 });
  return { organiser, tid };
}

const count = async (tid: string) => {
  const t = await Tournament.findById(tid).lean();
  return { registered: t!.registeredCount, waitlist: t!.waitlistCount };
};

describe('team registration', () => {
  it('registers a team as pending, notifies the organiser and blocks duplicates', async () => {
    const { organiser, tid } = await setup();
    const { agent: cap } = await signup();
    const team = await createTeam(cap);

    const res = await cap.post(`/api/tournaments/${tid}/register`, {
      teamId: team.id,
      note: 'Looking forward!',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', teamId: team.id, tournamentId: tid });
    expect(res.body.data.tournament.name).toBe('Sikar Premier League');
    expect(await count(tid)).toEqual({ registered: 1, waitlist: 0 });
    expect(
      await Notification.countDocuments({
        userId: organiser.user.id,
        type: 'registration_received',
      }),
    ).toBe(1);

    const dup = await cap.post(`/api/tournaments/${tid}/register`, { teamId: team.id });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({
      code: 'ALREADY_REGISTERED',
      message: 'Your team is already registered.',
    });
    expect(await count(tid)).toEqual({ registered: 1, waitlist: 0 });
  });

  it('refuses registration after the deadline', async () => {
    const { tid } = await setup();
    await Tournament.updateOne(
      { _id: tid },
      { registrationDeadline: new Date(Date.now() - 60_000) },
    );
    const { agent: cap } = await signup();
    const team = await createTeam(cap);
    const res = await cap.post(`/api/tournaments/${tid}/register`, { teamId: team.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'REGISTRATION_CLOSED',
      message: 'Registration is closed.',
    });
  });

  it('refuses registration for unverified tournaments', async () => {
    const organiser = await signup();
    const id = (await organiser.agent.post('/api/tournaments', tournamentInput())).body.data.id;
    await organiser.agent.post(`/api/tournaments/${id}/submit`);
    const { agent: cap } = await signup();
    const team = await createTeam(cap);
    const res = await cap.post(`/api/tournaments/${id}/register`, { teamId: team.id });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This tournament is awaiting verification.');
  });

  it('rejects when full without a waitlist, and waitlists when enabled', async () => {
    const noWait = await setup({ maxTeams: 2, allowWaitlist: false });
    const withWait = await setup({ name: 'Waitlist Cup', maxTeams: 2, allowWaitlist: true });
    const caps = await Promise.all([signup(), signup(), signup()]);
    const teams = await Promise.all(caps.map((c) => createTeam(c.agent)));

    for (const i of [0, 1]) {
      expect(
        (
          await caps[i]!.agent.post(`/api/tournaments/${noWait.tid}/register`, {
            teamId: teams[i]!.id,
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await caps[i]!.agent.post(`/api/tournaments/${withWait.tid}/register`, {
            teamId: teams[i]!.id,
          })
        ).status,
      ).toBe(201);
    }
    const full = await caps[2]!.agent.post(`/api/tournaments/${noWait.tid}/register`, {
      teamId: teams[2]!.id,
    });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('REGISTRATION_FULL');

    const wait = await caps[2]!.agent.post(`/api/tournaments/${withWait.tid}/register`, {
      teamId: teams[2]!.id,
    });
    expect(wait.status).toBe(201);
    expect(wait.body.data).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    expect(await count(withWait.tid)).toEqual({ registered: 2, waitlist: 1 });
  });

  it('never overbooks the last slot under concurrent registrations', async () => {
    const { tid } = await setup({ maxTeams: 3, allowWaitlist: false });
    const caps = await Promise.all(Array.from({ length: 8 }, () => signup()));
    const teams = await Promise.all(caps.map((c) => createTeam(c.agent)));
    const results = await Promise.all(
      caps.map((c, i) =>
        c.agent.post(`/api/tournaments/${tid}/register`, { teamId: teams[i]!.id }),
      ),
    );
    const ok = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.body.code === 'REGISTRATION_FULL').length;
    expect(ok).toBe(3);
    expect(full).toBe(5);
    expect((await count(tid)).registered).toBe(3);
  });

  it("does not allow registering another user's team, a wrong-sport team, an empty team or in your own tournament", async () => {
    const { organiser, tid } = await setup();
    const { agent: owner } = await signup();
    const { agent: thief } = await signup();
    const team = await createTeam(owner);
    const steal = await thief.post(`/api/tournaments/${tid}/register`, { teamId: team.id });
    expect(steal.status).toBe(403);

    const football = await createTeam(owner, { sport: 'football' });
    const wrong = await owner.post(`/api/tournaments/${tid}/register`, { teamId: football.id });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('TEAM_NOT_ELIGIBLE');

    const empty = await createTeam(owner, { name: 'Empty XI', players: [] });
    const emptyRes = await owner.post(`/api/tournaments/${tid}/register`, { teamId: empty.id });
    expect(emptyRes.body.code).toBe('TEAM_NOT_ELIGIBLE');

    const ownTeam = await createTeam(organiser.agent);
    const own = await organiser.agent.post(`/api/tournaments/${tid}/register`, {
      teamId: ownTeam.id,
    });
    expect(own.status).toBe(403);
    expect(own.body.code).toBe('OWN_TOURNAMENT');
    expect(await count(tid)).toEqual({ registered: 0, waitlist: 0 });
  });

  it('withdraws, frees the slot, promotes the waitlist (FIFO) and allows re-registration', async () => {
    const { tid } = await setup({ maxTeams: 1, allowWaitlist: true });
    const [a, b, c] = await Promise.all([signup(), signup(), signup()]);
    const [ta, tb, tc] = await Promise.all([
      createTeam(a.agent),
      createTeam(b.agent),
      createTeam(c.agent),
    ]);
    const ra = (await a.agent.post(`/api/tournaments/${tid}/register`, { teamId: ta.id })).body
      .data;
    const rb = (await b.agent.post(`/api/tournaments/${tid}/register`, { teamId: tb.id })).body
      .data;
    const rc = (await c.agent.post(`/api/tournaments/${tid}/register`, { teamId: tc.id })).body
      .data;
    expect([ra.status, rb.status, rc.status]).toEqual(['pending', 'waitlisted', 'waitlisted']);
    expect(rc.waitlistPosition).toBe(2);

    // Another user cannot withdraw it
    expect((await b.agent.patch(`/api/registrations/${ra.id}/withdraw`)).status).toBe(404);

    const w = await a.agent.patch(`/api/registrations/${ra.id}/withdraw`);
    expect(w.status).toBe(200);
    expect(w.body.data.status).toBe('withdrawn');
    expect((await a.agent.patch(`/api/registrations/${ra.id}/withdraw`)).status).toBe(409); // idempotent guard

    const bNow = (await b.agent.get('/api/me/registrations')).body.data[0];
    expect(bNow.status).toBe('pending'); // first in line promoted
    const cNow = (await c.agent.get('/api/me/registrations')).body.data[0];
    expect(cNow).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    expect(await count(tid)).toEqual({ registered: 1, waitlist: 1 });
    expect(
      await Notification.countDocuments({ userId: b.user.id, type: 'registration_promoted' }),
    ).toBe(1);

    // Re-register after withdrawing → goes to the back of the waitlist, same document reused
    const again = await a.agent.post(`/api/tournaments/${tid}/register`, { teamId: ta.id });
    expect(again.status).toBe(201);
    expect(again.body.data).toMatchObject({ id: ra.id, status: 'waitlisted', waitlistPosition: 2 });
  });

  it('does not allow withdrawing after the deadline', async () => {
    const { tid } = await setup();
    const { agent: cap } = await signup();
    const team = await createTeam(cap);
    const reg = (await cap.post(`/api/tournaments/${tid}/register`, { teamId: team.id })).body.data;
    await Tournament.updateOne({ _id: tid }, { registrationDeadline: new Date(Date.now() - 1000) });
    const res = await cap.patch(`/api/registrations/${reg.id}/withdraw`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REGISTRATION_CLOSED');
  });

  it('lets only the organiser (or admin) confirm/decline and see contact details', async () => {
    const { organiser, tid } = await setup({ maxTeams: 1 });
    const [a, b] = await Promise.all([signup({ phone: '9876500001' }), signup()]);
    const [ta, tb] = await Promise.all([createTeam(a.agent), createTeam(b.agent)]);
    const ra = (await a.agent.post(`/api/tournaments/${tid}/register`, { teamId: ta.id })).body
      .data;
    await b.agent.post(`/api/tournaments/${tid}/register`, { teamId: tb.id });

    expect((await a.agent.post(`/api/registrations/${ra.id}/confirm`)).status).toBe(403);
    expect((await a.agent.get(`/api/tournaments/${tid}/registrations`)).status).toBe(403);

    const list = await organiser.agent.get(`/api/tournaments/${tid}/registrations`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0].captain.phone).toBe('9876500001');
    expect(list.body.data[0].team.players).toHaveLength(2);

    const conf = await organiser.agent.post(`/api/registrations/${ra.id}/confirm`);
    expect(conf.status).toBe(200);
    expect(conf.body.data.status).toBe('confirmed');
    expect(
      await Notification.countDocuments({ userId: a.user.id, type: 'registration_confirmed' }),
    ).toBe(1);
    expect((await organiser.agent.post(`/api/registrations/${ra.id}/confirm`)).status).toBe(409);

    const dec = await organiser.agent.post(`/api/registrations/${ra.id}/decline`, {
      reason: 'Players not eligible',
    });
    expect(dec.body.data).toMatchObject({
      status: 'cancelled',
      decisionReason: 'Players not eligible',
    });
    // Declining a confirmed team frees its slot → b promoted from waitlist
    const bReg = (await b.agent.get('/api/me/registrations')).body.data[0];
    expect(bReg.status).toBe('pending');

    const admin = await createAdminAgent();
    expect((await admin.post(`/api/registrations/${bReg.id}/confirm`)).status).toBe(200);
  });

  it('cancelling a tournament cancels its registrations and notifies captains', async () => {
    const { organiser, tid } = await setup();
    const { agent: cap, user } = await signup();
    const team = await createTeam(cap);
    await cap.post(`/api/tournaments/${tid}/register`, { teamId: team.id });
    await organiser.agent.post(`/api/tournaments/${tid}/cancel`, { reason: 'Rain' });
    const regs = (await cap.get('/api/me/registrations?status=all')).body.data;
    expect(regs[0].status).toBe('cancelled');
    expect(
      await Notification.countDocuments({ userId: user.id, type: 'tournament_cancelled' }),
    ).toBe(1);
  });

  it('lists my registrations for one tournament', async () => {
    const { tid } = await setup();
    const { agent: cap } = await signup();
    const team = await createTeam(cap);
    await cap.post(`/api/tournaments/${tid}/register`, { teamId: team.id });
    const res = await cap.get(`/api/tournaments/${tid}/my-registrations`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].team.name).toBe(team.name ?? res.body.data[0].team.name);
  });
});
