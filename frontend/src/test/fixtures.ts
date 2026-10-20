import type { SportDTO, TeamDTO, TournamentDTO, UserDTO } from '@playlocal/shared';

export const user: UserDTO = {
  id: 'u1',
  name: 'Priya Verma',
  email: 'priya@example.com',
  role: 'user',
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
};

export const sports: SportDTO[] = [
  { id: 's1', name: 'Cricket', slug: 'cricket', icon: '🏏', active: true, order: 1 },
  { id: 's2', name: 'Football', slug: 'football', icon: '⚽', active: true, order: 2 },
];

export const tournament: TournamentDTO = {
  id: 't1',
  name: 'Sikar Premier League',
  sport: 'cricket',
  organizerId: 'org1',
  organizer: { id: 'org1', name: 'Rakesh' },
  venue: { name: 'Stadium', address: 'Station Road', city: 'Sikar', state: 'Rajasthan' },
  startDate: '2026-11-10',
  endDate: '2026-11-12',
  registrationDeadline: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  maxTeams: 8,
  allowWaitlist: true,
  entryFee: 500,
  prizeMoney: 21000,
  rules: [],
  status: 'published',
  verified: true,
  registeredCount: 2,
  waitlistCount: 0,
  availability: 'open',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const team = (id: string, name: string, players: number): TeamDTO => ({
  id,
  name,
  sport: 'cricket',
  captainId: 'u1',
  players: Array.from({ length: players }, (_, i) => ({
    id: `${id}-p${i}`,
    name: `Player ${i + 1}`,
  })),
  playerCount: players,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

export const teams = {
  ready: team('team-ready', 'Palsana Panthers', 11),
  empty: team('team-empty', 'Empty XI', 0),
  registered: team('team-reg', 'Already In', 11),
};
