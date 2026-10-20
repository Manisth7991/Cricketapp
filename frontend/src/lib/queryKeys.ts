import type { TournamentQuery } from '@playlocal/shared';

/** Central query-key factory — keeps cache invalidation precise and typo-free. */
export const qk = {
  me: ['me'] as const,
  sports: ['sports'] as const,
  tournaments: {
    all: ['tournaments'] as const,
    list: (q: TournamentQuery) => ['tournaments', 'list', q] as const,
    detail: (id: string) => ['tournaments', 'detail', id] as const,
    mine: (status: string, page: number) => ['tournaments', 'mine', status, page] as const,
    registrations: (id: string) => ['tournaments', 'registrations', id] as const,
    myRegistrationsFor: (id: string) => ['tournaments', 'my-registrations', id] as const,
  },
  teams: {
    all: ['teams'] as const,
    list: (sport?: string) => ['teams', 'list', sport ?? 'all'] as const,
    detail: (id: string) => ['teams', 'detail', id] as const,
  },
  registrations: {
    all: ['registrations'] as const,
    mine: (status: string, page: number) => ['registrations', 'mine', status, page] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (page: number) => ['notifications', 'list', page] as const,
    unread: ['notifications', 'unread'] as const,
  },
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    tournaments: (p: object) => ['admin', 'tournaments', p] as const,
    tournament: (id: string) => ['admin', 'tournament', id] as const,
    users: (p: object) => ['admin', 'users', p] as const,
    teams: (p: object) => ['admin', 'teams', p] as const,
    reports: (p: object) => ['admin', 'reports', p] as const,
    sports: ['admin', 'sports'] as const,
  },
};
