import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '@playlocal/shared';
import { Registration } from '../src/models';
import { createPublishedTournament, createTeam, seedSports, signup } from './helpers';

beforeEach(seedSports);

describe('teams', () => {
  it('creates a team with players and lists only my teams', async () => {
    const { agent: a } = await signup();
    const { agent: b } = await signup();
    const res = await a.post('/api/teams', {
      name: 'Palsana Panthers',
      sport: 'Cricket',
      location: { city: 'palsana', state: 'Rajasthan' },
      players: [
        { name: 'Mahesh', role: 'Captain' },
        { name: 'Sunil', phone: '+91 98111 22222' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Palsana Panthers',
      sport: 'cricket',
      playerCount: 2,
      location: { city: 'Palsana' },
    });
    expect(res.body.data.players[1].phone).toBe('9811122222');
    await createTeam(b);
    const mine = await a.get('/api/teams');
    expect(mine.body.data).toHaveLength(1);
    expect((await a.get('/api/teams?sport=football')).body.data).toHaveLength(0);
  });

  it('rejects duplicate team names (case-insensitive) for the same sport', async () => {
    const { agent: a } = await signup();
    await createTeam(a, { name: 'Strikers' });
    const dup = await a.post('/api/teams', { name: 'STRIKERS', sport: 'cricket' });
    expect(dup.status).toBe(409);
    const otherSport = await a.post('/api/teams', { name: 'Strikers', sport: 'football' });
    expect(otherSport.status).toBe(201);
  });

  it('adds, edits and removes players with duplicate checks', async () => {
    const { agent: a } = await signup();
    const team = await createTeam(a);
    const add = await a.post(`/api/teams/${team.id}/players`, { name: 'Vikram', role: 'Bowler' });
    expect(add.status).toBe(201);
    expect(add.body.data.playerCount).toBe(3);

    const dupName = await a.post(`/api/teams/${team.id}/players`, { name: 'player one' });
    expect(dupName.status).toBe(409);
    expect(dupName.body.code).toBe('DUPLICATE_PLAYER');
    const dupPhone = await a.post(`/api/teams/${team.id}/players`, {
      name: 'New Guy',
      phone: '9811111111',
    });
    expect(dupPhone.status).toBe(409);

    const pid = team.players[0]!.id;
    const edit = await a.patch(`/api/teams/${team.id}/players/${pid}`, {
      name: 'Player One Jr',
      role: 'Wicket keeper',
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.players[0]).toMatchObject({
      name: 'Player One Jr',
      role: 'Wicket keeper',
    });

    const del = await a.delete(`/api/teams/${team.id}/players/${pid}`);
    expect(del.status).toBe(200);
    expect(del.body.data.playerCount).toBe(2);
    expect((await a.delete(`/api/teams/${team.id}/players/${pid}`)).status).toBe(404);
  });

  it('enforces the player limit', async () => {
    const { agent: a } = await signup();
    const players = Array.from({ length: LIMITS.maxPlayersPerTeam }, (_, i) => ({
      name: `Player ${i + 1}`,
    }));
    const team = await createTeam(a, { players });
    const over = await a.post(`/api/teams/${team.id}/players`, { name: 'One Too Many' });
    expect(over.status).toBe(409);
    expect(over.body.code).toBe('PLAYER_LIMIT_REACHED');
  });

  it('prevents other users from viewing or editing a team', async () => {
    const { agent: owner } = await signup();
    const { agent: intruder } = await signup();
    const team = await createTeam(owner);
    expect((await intruder.get(`/api/teams/${team.id}`)).status).toBe(404);
    expect((await intruder.patch(`/api/teams/${team.id}`, { name: 'Hacked' })).status).toBe(403);
    expect((await intruder.post(`/api/teams/${team.id}/players`, { name: 'Spy' })).status).toBe(
      403,
    );
    expect(
      (await intruder.delete(`/api/teams/${team.id}/players/${team.players[0]!.id}`)).status,
    ).toBe(403);
    expect((await intruder.delete(`/api/teams/${team.id}`)).status).toBe(403);
  });

  it('lets the organiser of a tournament the team registered for view the roster', async () => {
    const { agent: organiser } = await signup();
    const { agent: captain, user } = await signup();
    const tid = await createPublishedTournament(organiser);
    const team = await createTeam(captain);
    await Registration.create({
      tournamentId: tid,
      teamId: team.id,
      captainId: user.id,
      status: 'pending',
    });
    const res = await organiser.get(`/api/teams/${team.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.players).toHaveLength(2);
  });

  it('blocks deleting a team or changing its sport while registered', async () => {
    const { agent: organiser } = await signup();
    const { agent: captain, user } = await signup();
    const tid = await createPublishedTournament(organiser);
    const team = await createTeam(captain);
    await Registration.create({
      tournamentId: tid,
      teamId: team.id,
      captainId: user.id,
      status: 'confirmed',
    });
    const del = await captain.delete(`/api/teams/${team.id}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('TEAM_HAS_ACTIVE_REGISTRATIONS');
    expect((await captain.patch(`/api/teams/${team.id}`, { sport: 'football' })).status).toBe(409);
    expect((await captain.patch(`/api/teams/${team.id}`, { name: 'Renamed XI' })).status).toBe(200);

    await Registration.updateMany({ teamId: team.id }, { status: 'withdrawn' });
    expect((await captain.delete(`/api/teams/${team.id}`)).status).toBe(200);
    expect((await captain.get('/api/teams')).body.data).toHaveLength(0);
  });

  it('validates input', async () => {
    const { agent: a } = await signup();
    expect((await a.post('/api/teams', { name: 'X', sport: 'cricket' })).status).toBe(400);
    expect((await a.post('/api/teams', { name: 'Valid Name', sport: 'polo' })).status).toBe(400);
    expect(
      (
        await a.post('/api/teams', {
          name: 'Valid Name',
          sport: 'cricket',
          players: [{ name: 'A', phone: '12' }],
        })
      ).status,
    ).toBe(400);
  });
});
