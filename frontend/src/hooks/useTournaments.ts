import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TournamentQuery } from '@playlocal/shared';
import { tournamentService } from '@/services/tournamentService';
import { qk } from '@/lib/queryKeys';

export function useTournamentList(query: TournamentQuery, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.tournaments.list(query),
    queryFn: ({ signal }) => tournamentService.list(query, signal),
    placeholderData: keepPreviousData, // no flash of skeletons between pages/filters
    enabled: opts.enabled ?? true,
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: qk.tournaments.detail(id ?? ''),
    queryFn: () => tournamentService.get(id!),
    enabled: Boolean(id),
  });
}
