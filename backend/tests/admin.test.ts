import { beforeEach, describe, expect, it } from 'vitest';
import { Notification, Tournament, User } from '../src/models';
import {
  agent,
  createAdminAgent,
  createPublishedTournament,
  createTeam,
  seedSports,
  signup,
  tournamentInput,
} from './helpers';

beforeEach(seedSports);

async function submitted() {
  const owner = await signup();
  const id = (await owner.agent.post('/api/tournaments', tournamentInput())).body.data.id as string;
  expect((await owner.agent.post(`/api/tournaments/${id}/submit`)).status).toBe(200);
  return { owner, id };
}

describe('admin authorization', () => {
  it('rejects anonymous and non-admin users on every admin route', async () => {
    const { agent: user } = await signup();
    for (const path of [
      '/api/admin/stats',
      '/api/admin/tournaments',
      '/api/admin/users',
      '/api/admin/reports',
      '/api/admin/teams',
      '/api/admin/sports',
    ]) {
      expect((await agent().get(path)).status).toBe(401);
      expect((await user.get(path)).status).toBe(403);
    }
    expect(
      (await user.post('/api/admin/tournaments/000000000000000000000000/approve')).status,
    ).toBe(403);
  });
});

describe('tournament verification', () => {
  it('lists the pending queue and approves → published with Verified badge + notification', async () => {
    const { owner, id } = await submitted();
    const admin = await createAdminAgent();
    const queue = await admin.get('/api/admin/tournaments/pending');
    expect(queue.body.data.map((t: { id: string }) => t.id)).toEqual([id]);

    const res = await admin.post(`/api/admin/tournaments/${id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'published', verified: true });
    expect(
      (await agent().get('/api/tournaments')).body.data.map((t: { id: string }) => t.id),
    ).toContain(id);
    expect(
      await Notification.countDocuments({ userId: owner.user.id, type: 'tournament_approved' }),
    ).toBe(1);

    // Can't approve twice
    expect((await admin.post(`/api/admin/tournaments/${id}/approve`)).status).toBe(409);
  });

  it('rejects with a required reason; rejected stays hidden and the owner can edit + resubmit', async () => {
    const { owner, id } = await submitted();
    const admin = await createAdminAgent();
    expect((await admin.post(`/api/admin/tournaments/${id}/reject`, {})).status).toBe(400);
    const res = await admin.post(`/api/admin/tournaments/${id}/reject`, {
      reason: 'Venue address is incomplete',
    });
    expect(res.body.data).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Venue address is incomplete',
      verified: false,
    });
    expect((await agent().get('/api/tournaments')).body.data).toHaveLength(0);
    expect((await agent().get(`/api/tournaments/${id}`)).status).toBe(404);

    const ownerView = await owner.agent.get(`/api/tournaments/${id}`);
    expect(ownerView.body.data.rejectionReason).toBe('Venue address is incomplete');
    expect(
      (
        await owner.agent.patch(`/api/tournaments/${id}`, {
          venue: { address: 'Full address, Ward 5, Station Road' },
        })
      ).status,
    ).toBe(200);
    const resubmit = await owner.agent.post(`/api/tournaments/${id}/submit`);
    expect(resubmit.body.data.status).toBe('pending_verification');
    expect(resubmit.body.data.rejectionReason).toBeUndefined();
  });

  it('suspends (disappears from discovery) and reinstates', async () => {
    const { owner } = await submitted();
    const id = await createPublishedTournament(owner.agent, { name: 'Live Cup' });
    const admin = await createAdminAgent();
    expect(
      (
        await admin.post(`/api/admin/tournaments/${id}/suspend`, {
          reason: 'Multiple fraud reports',
        })
      ).body.data.status,
    ).toBe('suspended');
    expect(
      (await agent().get('/api/tournaments')).body.data.map((t: { id: string }) => t.id),
    ).not.toContain(id);
    expect((await agent().get(`/api/tournaments/${id}`)).status).toBe(404);

    const { agent: cap } = await signup();
    const team = await createTeam(cap);
    expect((await cap.post(`/api/tournaments/${id}/register`, { teamId: team.id })).status).toBe(
      409,
    );

    expect((await admin.post(`/api/admin/tournaments/${id}/reinstate`)).body.data.status).toBe(
      'published',
    );
    expect((await agent().get(`/api/tournaments/${id}`)).status).toBe(200);
  });

  it('shows organiser contact details on the admin tournament view', async () => {
    const { id } = await submitted();
    const admin = await createAdminAgent();
    const res = await admin.get(`/api/admin/tournaments/${id}`);
    expect(res.body.data.organizerContact.phone).toMatch(/^9\d{9}$/);
    expect(res.body.data.openReports).toBe(0);
  });
});

describe('user management & stats', () => {
  it('blocks and unblocks users; cannot block admins or self', async () => {
    const { agent: u, user } = await signup({ name: 'Spammer' });
    const admin = await createAdminAgent();
    const list = await admin.get('/api/admin/users?search=spammer');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ teamCount: 0, tournamentCount: 0 });

    expect(
      (await admin.patch(`/api/admin/users/${user.id}/status`, { status: 'blocked' })).status,
    ).toBe(200);
    expect((await u.get('/api/auth/me')).status).toBe(403);
    expect(
      (await admin.patch(`/api/admin/users/${user.id}/status`, { status: 'active' })).status,
    ).toBe(200);
    expect((await u.get('/api/auth/me')).status).toBe(200);

    const adminDoc = await User.findOne({ role: 'admin' }).lean();
    expect(
      (await admin.patch(`/api/admin/users/${adminDoc!._id}/status`, { status: 'blocked' })).status,
    ).toBe(400);
  });

  it('returns dashboard stats', async () => {
    await submitted();
    const admin = await createAdminAgent();
    const res = await admin.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.tournaments.pending_verification).toBe(1);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(1);
  });

  it('manages sports categories', async () => {
    const admin = await createAdminAgent();
    const created = await admin.post('/api/admin/sports', { name: 'Kho Kho', icon: '🏃' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('kho-kho');
    expect((await admin.post('/api/admin/sports', { name: 'Kho-Kho' })).status).toBe(409);
    expect(
      (await agent().get('/api/sports')).body.data.map((s: { slug: string }) => s.slug),
    ).toContain('kho-kho');
    await admin.patch(`/api/admin/sports/${created.body.data.id}`, { active: false });
    expect(
      (await agent().get('/api/sports')).body.data.map((s: { slug: string }) => s.slug),
    ).not.toContain('kho-kho');
    const all = await admin.get('/api/admin/sports');
    expect(all.body.data.find((s: { slug: string }) => s.slug === 'kho-kho').active).toBe(false);
  });
});

describe('reports', () => {
  it('lets users report a public tournament once; admin reviews and resolves', async () => {
    const owner = await signup();
    const id = await createPublishedTournament(owner.agent);
    const { agent: reporter, user } = await signup();
    expect(
      (
        await agent().post(`/api/tournaments/${id}/report`, {
          reason: 'scam_or_fraud',
          description: 'Asking for UPI payment upfront',
        })
      ).status,
    ).toBe(401);
    expect(
      (await reporter.post(`/api/tournaments/${id}/report`, { reason: 'bogus', description: 'x' }))
        .status,
    ).toBe(400);
    expect(
      (
        await reporter.post(`/api/tournaments/${id}/report`, {
          reason: 'scam_or_fraud',
          description: 'Asking for UPI payment upfront',
        })
      ).status,
    ).toBe(201);
    const dup = await reporter.post(`/api/tournaments/${id}/report`, {
      reason: 'other',
      description: 'Reporting the same again',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_REPORTED');
    expect(
      (
        await owner.agent.post(`/api/tournaments/${id}/report`, {
          reason: 'other',
          description: 'Reporting myself',
        })
      ).status,
    ).toBe(400);

    // Non-admin cannot manage reports
    expect((await reporter.get('/api/admin/reports')).status).toBe(403);

    const admin = await createAdminAgent();
    const list = await admin.get('/api/admin/reports');
    expect(list.body.data).toHaveLength(1);
    const reportId = list.body.data[0].id;
    expect(list.body.data[0].tournament.name).toBe('Sikar Premier League');
    expect(
      (await reporter.patch(`/api/admin/reports/${reportId}`, { status: 'resolved' })).status,
    ).toBe(403);

    await admin.patch(`/api/admin/reports/${reportId}`, { status: 'under_review' });
    const resolved = await admin.patch(`/api/admin/reports/${reportId}`, {
      status: 'resolved',
      resolutionNote: 'Organiser warned',
    });
    expect(resolved.body.data.status).toBe('resolved');
    expect(await Notification.countDocuments({ userId: user.id, type: 'report_updated' })).toBe(1);

    // After resolution, the same user may report again (new issue)
    expect(
      (
        await reporter.post(`/api/tournaments/${id}/report`, {
          reason: 'other',
          description: 'A new problem appeared',
        })
      ).status,
    ).toBe(201);
  });

  it('cannot report unpublished tournaments', async () => {
    const owner = await signup();
    const id = (await owner.agent.post('/api/tournaments', tournamentInput())).body.data.id;
    const { agent: r } = await signup();
    expect(
      (
        await r.post(`/api/tournaments/${id}/report`, {
          reason: 'other',
          description: 'Something odd here',
        })
      ).status,
    ).toBe(404);
    expect(await Tournament.countDocuments()).toBe(1);
  });
});

describe('notifications', () => {
  it('lists, counts unread and marks read — only for the owner', async () => {
    const { owner, id } = await submitted();
    const admin = await createAdminAgent();
    await admin.post(`/api/admin/tournaments/${id}/approve`);
    expect((await owner.agent.get('/api/notifications/unread-count')).body.data.count).toBe(1);
    const list = await owner.agent.get('/api/notifications');
    expect(list.body.data[0]).toMatchObject({
      type: 'tournament_approved',
      read: false,
      link: `/my-tournaments/${id}`,
    });

    const { agent: other } = await signup();
    expect((await other.patch(`/api/notifications/${list.body.data[0].id}/read`)).status).toBe(404);
    expect(
      (await owner.agent.patch(`/api/notifications/${list.body.data[0].id}/read`)).status,
    ).toBe(200);
    expect((await owner.agent.get('/api/notifications/unread-count')).body.data.count).toBe(0);
    await owner.agent.post('/api/notifications/read-all');
    expect((await agent().get('/api/notifications')).status).toBe(401);
  });
});
