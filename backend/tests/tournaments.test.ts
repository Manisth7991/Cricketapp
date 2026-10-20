import { beforeEach, describe, expect, it } from 'vitest';
import { Tournament } from '../src/models';
import {
  agent,
  createAdminAgent,
  createPublishedTournament,
  isoInDays,
  seedSports,
  signup,
  tournamentInput,
} from './helpers';

beforeEach(seedSports);

describe('tournament creation & verification lifecycle', () => {
  it('creates a draft that is not public and has no verified badge', async () => {
    const { agent: owner } = await signup();
    const res = await owner.post('/api/tournaments', tournamentInput());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'draft', verified: false, sport: 'cricket' });
    expect(res.body.data.venue.city).toBe('Sikar'); // normalised casing

    const list = await agent().get('/api/tournaments');
    expect(list.body.data).toHaveLength(0);
    const other = await signup();
    expect((await other.agent.get(`/api/tournaments/${res.body.data.id}`)).status).toBe(404);
    expect((await owner.get(`/api/tournaments/${res.body.data.id}`)).status).toBe(200);
  });

  it('requires authentication to create', async () => {
    const res = await agent().post('/api/tournaments', tournamentInput());
    expect(res.status).toBe(401);
  });

  it('validates sport, dates and fields', async () => {
    const { agent: a } = await signup();
    const inactive = await a.post('/api/tournaments', tournamentInput({ sport: 'polo' }));
    expect(inactive.status).toBe(400);
    expect(inactive.body.errors[0].path).toBe('sport');

    const badDates = await a.post(
      '/api/tournaments',
      tournamentInput({ endDate: isoInDays(10), startDate: isoInDays(20) }),
    );
    expect(badDates.status).toBe(400);
    expect(badDates.body.errors.some((e: { path: string }) => e.path === 'endDate')).toBe(true);

    const past = await a.post(
      '/api/tournaments',
      tournamentInput({
        startDate: isoInDays(-3),
        endDate: isoInDays(-2),
        registrationDeadline: isoInDays(-4),
      }),
    );
    expect(past.status).toBe(400);

    const deadline = await a.post(
      '/api/tournaments',
      tournamentInput({ registrationDeadline: isoInDays(25) }),
    );
    expect(deadline.status).toBe(400);
    expect(deadline.body.errors[0].path).toBe('registrationDeadline');
  });

  it('allows a minimal draft and refuses to submit it until complete', async () => {
    const { agent: a } = await signup();
    const draft = await a.post('/api/tournaments', { name: 'Kabaddi Cup', sport: 'kabaddi' });
    expect(draft.status).toBe(201);
    const id = draft.body.data.id;
    const submit = await a.post(`/api/tournaments/${id}/submit`);
    expect(submit.status).toBe(400);
    expect(submit.body.code).toBe('TOURNAMENT_INCOMPLETE');
    expect(submit.body.errors.length).toBeGreaterThan(0);

    const { name: _n, sport: _s, ...rest } = tournamentInput();
    expect((await a.patch(`/api/tournaments/${id}`, rest)).status).toBe(200);
    const ok = await a.post(`/api/tournaments/${id}/submit`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('pending_verification');
    expect(ok.body.data.verified).toBe(false);

    const again = await a.post(`/api/tournaments/${id}/submit`);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('This tournament is awaiting verification.');
  });

  it('rejects images that were not uploaded through our storage', async () => {
    const { agent: a } = await signup();
    const res = await a.post(
      '/api/tournaments',
      tournamentInput({ banner: 'https://evil.example.com/x.png' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
  });
});

describe('ownership and edit rules', () => {
  it("forbids editing or deleting someone else's tournament", async () => {
    const { agent: owner } = await signup();
    const { agent: intruder } = await signup();
    const id = (await owner.post('/api/tournaments', tournamentInput())).body.data.id;
    expect((await intruder.patch(`/api/tournaments/${id}`, { name: 'Hacked name' })).status).toBe(
      403,
    );
    expect((await intruder.delete(`/api/tournaments/${id}`)).status).toBe(403);
    expect((await intruder.post(`/api/tournaments/${id}/submit`)).status).toBe(403);
  });

  it('limits edits once published', async () => {
    const { agent: owner } = await signup();
    const id = await createPublishedTournament(owner);
    const locked = await owner.patch(`/api/tournaments/${id}`, { prizeMoney: 99999 });
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe('TOURNAMENT_NOT_EDITABLE');
    const allowed = await owner.patch(`/api/tournaments/${id}`, {
      description: 'Updated description with more details for teams.',
      maxTeams: 12,
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.maxTeams).toBe(12);
    expect(allowed.body.data.prizeMoney).toBe(21000); // untouched — no zod defaults leaking into PATCH
  });

  it('does not allow deleting a published tournament (cancel instead)', async () => {
    const { agent: owner } = await signup();
    const id = await createPublishedTournament(owner);
    expect((await owner.delete(`/api/tournaments/${id}`)).status).toBe(409);
    const cancel = await owner.post(`/api/tournaments/${id}/cancel`, {
      reason: 'Ground unavailable',
    });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled');
    expect((await agent().get('/api/tournaments')).body.data).toHaveLength(0);
  });

  it('lets an admin edit any tournament', async () => {
    const { agent: owner } = await signup();
    const id = await createPublishedTournament(owner);
    const admin = await createAdminAgent();
    const res = await admin.patch(`/api/tournaments/${id}`, { prizeMoney: 30000 });
    expect(res.status).toBe(200);
    expect(res.body.data.prizeMoney).toBe(30000);
  });

  it('lists my tournaments with status counts', async () => {
    const { agent: a } = await signup();
    await a.post('/api/tournaments', tournamentInput());
    await createPublishedTournament(a, { name: 'Another Cup' });
    const res = await a.get('/api/me/tournaments');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.counts).toMatchObject({ draft: 1, published: 1 });
    const drafts = await a.get('/api/me/tournaments?status=draft');
    expect(drafts.body.data).toHaveLength(1);
  });
});

describe('public discovery', () => {
  it('shows only published tournaments with filters, search and pagination', async () => {
    const { agent: a } = await signup();
    await createPublishedTournament(a, { name: 'Sikar Cricket Cup' });
    await createPublishedTournament(a, {
      name: 'Jaipur Football League',
      sport: 'football',
      venue: {
        name: 'SMS Stadium',
        address: 'Tonk Road, Jaipur',
        city: 'Jaipur',
        state: 'Rajasthan',
      },
    });
    await createPublishedTournament(a, {
      name: 'Pune Kabaddi Mahotsav',
      sport: 'kabaddi',
      prizeMoney: 51000,
      venue: {
        name: 'Shivaji Ground',
        address: 'FC Road, Pune',
        city: 'Pune',
        state: 'Maharashtra',
      },
    });
    await a.post('/api/tournaments', tournamentInput({ name: 'Hidden Draft' }));

    const all = await agent().get('/api/tournaments');
    expect(all.body.data).toHaveLength(3);
    expect(all.body.data.every((t: { verified: boolean }) => t.verified)).toBe(true);
    expect(all.body.data[0].description).toBeUndefined(); // list projection

    expect((await agent().get('/api/tournaments?sport=football')).body.data).toHaveLength(1);
    expect((await agent().get('/api/tournaments?state=Maharashtra')).body.data).toHaveLength(1);
    expect((await agent().get('/api/tournaments?city=JAIPUR')).body.data).toHaveLength(1);
    expect((await agent().get('/api/tournaments?search=kabaddi')).body.data[0].name).toBe(
      'Pune Kabaddi Mahotsav',
    );
    expect((await agent().get('/api/tournaments?search=(')).status).toBe(200); // regex escaped
    expect((await agent().get('/api/tournaments?sort=prize')).body.data[0].prizeMoney).toBe(51000);

    const page = await agent().get('/api/tournaments?limit=2&page=2');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect((await agent().get('/api/tournaments?limit=999')).status).toBe(400);
  });

  it('filters by availability', async () => {
    const { agent: a } = await signup();
    const openId = await createPublishedTournament(a, { name: 'Open Cup' });
    const fullId = await createPublishedTournament(a, {
      name: 'Full Cup',
      allowWaitlist: false,
      maxTeams: 2,
    });
    await Tournament.updateOne({ _id: fullId }, { registeredCount: 2 });
    const closedId = await createPublishedTournament(a, { name: 'Closed Cup' });
    await Tournament.updateOne(
      { _id: closedId },
      { registrationDeadline: new Date(Date.now() - 3_600_000) },
    );

    const open = (await agent().get('/api/tournaments?status=open')).body.data.map(
      (t: { id: string }) => t.id,
    );
    expect(open).toEqual([openId]);
    const closed = (await agent().get('/api/tournaments?status=closed')).body.data.map(
      (t: { id: string }) => t.id,
    );
    expect(closed).toEqual([closedId]);
    const full = (await agent().get(`/api/tournaments/${fullId}`)).body.data;
    expect(full.availability).toBe('full');
  });

  it('sorts by nearest and reports distance', async () => {
    const { agent: a } = await signup();
    await createPublishedTournament(a, {
      name: 'Sikar',
      venue: {
        name: 'Ground',
        address: 'Sikar town',
        city: 'Sikar',
        state: 'Rajasthan',
        coordinates: { lat: 27.6094, lng: 75.1399 },
      },
    });
    await createPublishedTournament(a, {
      name: 'Jaipur',
      venue: {
        name: 'Ground',
        address: 'Jaipur city',
        city: 'Jaipur',
        state: 'Rajasthan',
        coordinates: { lat: 26.9124, lng: 75.7873 },
      },
    });
    await createPublishedTournament(a, {
      name: 'Mumbai',
      venue: {
        name: 'Ground',
        address: 'Mumbai city',
        city: 'Mumbai',
        state: 'Maharashtra',
        coordinates: { lat: 19.076, lng: 72.8777 },
      },
    });

    // User standing in Jaipur, default 150 km radius → Jaipur first, Sikar second, Mumbai excluded.
    const res = await agent().get('/api/tournaments?sort=nearest&lat=26.92&lng=75.79');
    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['Jaipur', 'Sikar']);
    expect(res.body.data[0].distanceKm).toBeLessThan(2);
    expect(res.body.data[1].distanceKm).toBeGreaterThan(80);

    // nearest + availability filter ($expr inside $geoNear query) must work together
    await Tournament.updateOne(
      { name: 'Jaipur' },
      { registrationDeadline: new Date(Date.now() - 1000) },
    );
    const openNear = await agent().get(
      '/api/tournaments?sort=nearest&status=open&lat=26.92&lng=75.79',
    );
    expect(openNear.status).toBe(200);
    expect(openNear.body.data.map((t: { name: string }) => t.name)).toEqual(['Sikar']);

    const byDate = await agent().get('/api/tournaments?lat=26.92&lng=75.79');
    expect(
      byDate.body.data.find((t: { name: string }) => t.name === 'Mumbai').distanceKm,
    ).toBeGreaterThan(900);
  });

  it('returns 404 for invalid ids and hides moderation reasons from the public', async () => {
    expect((await agent().get('/api/tournaments/not-an-id')).status).toBe(404);
    const { agent: owner } = await signup();
    const id = await createPublishedTournament(owner);
    await Tournament.updateOne({ _id: id }, { rejectionReason: 'old' });
    const pub = await agent().get(`/api/tournaments/${id}`);
    expect(pub.body.data.rejectionReason).toBeUndefined();
    expect(pub.body.data.organizer.name).toBeTruthy();
  });

  it('serves active sports only', async () => {
    const res = await agent().get('/api/sports');
    expect(res.body.data.map((s: { slug: string }) => s.slug)).toEqual([
      'cricket',
      'football',
      'kabaddi',
    ]);
  });
});
